;;; lemmaduck.el --- LemmaDuck research workbench -*- lexical-binding: t; -*-

;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; URL: https://github.com/ts06068/lemmaduck/tree/main/distros/emacs
;;; Commentary:
;; Launch the shared LemmaDuck CLI without duplicating its authentication,
;; routing or task storage.  This preview uses Emacs's built-in terminal.
;;; Code:

(require 'cl-lib)
(require 'term)
(require 'easymenu)
(require 'project)

(defgroup lemmaduck nil "LemmaDuck research workbench." :group 'tools)
(defcustom lemmaduck-executable "lemmaduck"
  "Shared LemmaDuck executable; a path, never a shell command."
  :type 'string :group 'lemmaduck)
(defvar lemmaduck-project-directory nil)
(defvar lemmaduck--terminals (make-hash-table :test #'equal))

(defun lemmaduck--project ()
  "Return the selected local project directory."
  (let ((directory (or lemmaduck-project-directory
                       (when-let ((project (project-current nil)))
                         (project-root project))
                       default-directory)))
    (when (file-remote-p directory)
      (user-error "This preview runs on the host: use Emacs over SSH there"))
    (unless (file-directory-p directory) (user-error "Project directory is missing"))
    (file-name-as-directory (expand-file-name directory))))

(defun lemmaduck-open-project (directory)
  "Choose DIRECTORY for subsequent LemmaDuck actions."
  (interactive "DProject directory: ")
  (setq lemmaduck-project-directory (file-name-as-directory (expand-file-name directory)))
  (lemmaduck--project)
  (dired lemmaduck-project-directory))

(defun lemmaduck--command (action project)
  "Return the argument vector for ACTION in PROJECT."
  (pcase action
    ('research (list lemmaduck-executable "agent" project "--pi"))
    ('code (list lemmaduck-executable "code" project))
    ('resume (list lemmaduck-executable "agent" project))
    ('status (list lemmaduck-executable "status" project))
    (_ (user-error "Unknown LemmaDuck action: %s" action))))

(defun lemmaduck--start (action)
  "Open ACTION, reusing a live terminal for this project and action."
  (let* ((directory (lemmaduck--project))
         (key (cons directory action))
         (existing (gethash key lemmaduck--terminals))
         (command (lemmaduck--command action directory)))
    (unless (executable-find lemmaduck-executable)
      (user-error "Install the shared LemmaDuck engine and add it to PATH"))
    (if (and (buffer-live-p existing) (get-buffer-process existing)
             (process-live-p (get-buffer-process existing)))
        (pop-to-buffer existing)
      (let* ((default-directory directory)
             (name (format "LemmaDuck %s %s %s" action
                           (file-name-nondirectory (directory-file-name directory))
                           (substring (secure-hash 'sha1 directory) 0 8)))
             (buffer (apply #'make-term name (car command) nil (cdr command))))
        (puthash key buffer lemmaduck--terminals)
        (pop-to-buffer buffer)
        (term-mode)
        (term-char-mode)
        (setq-local term-prompt-regexp "^[^\n]*[>$] *")))))

(defun lemmaduck-research () "Open the managed Pi research worker." (interactive) (lemmaduck--start 'research))
(defun lemmaduck-code () "Open the OMP coding worker." (interactive) (lemmaduck--start 'code))
(defun lemmaduck-resume () "Open the project's default worker." (interactive) (lemmaduck--start 'resume))

(defun lemmaduck-status ()
  "Display the shared task status asynchronously."
  (interactive)
  (let* ((directory (lemmaduck--project))
         (buffer (get-buffer-create "*LemmaDuck status*"))
         (existing (get-buffer-process buffer)))
    (when (and existing (process-live-p existing)) (user-error "Status is still loading"))
    (with-current-buffer buffer
      (let ((inhibit-read-only t)) (erase-buffer))
      (special-mode))
    (make-process :name "lemmaduck-status" :buffer buffer :noquery t
                  :command (lemmaduck--command 'status directory))
    (pop-to-buffer buffer)))

(defun lemmaduck-copy-context (begin end)
  "Copy selected text with its source path and lines, without submitting it."
  (interactive (if (use-region-p) (list (region-beginning) (region-end))
                 (list (point-min) (point-max))))
  (kill-new (format "%s:%d-%d\n%s" (or buffer-file-name (buffer-name))
                    (line-number-at-pos begin) (line-number-at-pos end)
                    (buffer-substring-no-properties begin end)))
  (message "Context copied; paste it into the worker when ready"))

(defvar lemmaduck-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "C-c l o") #'lemmaduck-open-project)
    (define-key map (kbd "C-c l r") #'lemmaduck-research)
    (define-key map (kbd "C-c l c") #'lemmaduck-code)
    (define-key map (kbd "C-c l s") #'lemmaduck-status)
    (define-key map (kbd "C-c l y") #'lemmaduck-copy-context)
    map))

(easy-menu-define lemmaduck-menu lemmaduck-mode-map "LemmaDuck actions"
  '("LemmaDuck"
    ["Open project" lemmaduck-open-project t]
    ["Research / writing / assistant (Pi)" lemmaduck-research t]
    ["Code (OMP)" lemmaduck-code t]
    ["Resume project" lemmaduck-resume t]
    ["Task status" lemmaduck-status t]
    ["Copy selected context" lemmaduck-copy-context t]))

(define-minor-mode lemmaduck-mode
  "Enable the LemmaDuck menu and optional C-c l bindings."
  :global t :lighter " Duck" :keymap lemmaduck-mode-map)

(defun lemmaduck-dashboard ()
  "Show a clickable starting screen."
  (interactive)
  (let ((buffer (get-buffer-create "*LemmaDuck*")))
    (with-current-buffer buffer
      (let ((inhibit-read-only t))
        (erase-buffer)
        (insert "LemmaDuck Emacs\nTalk to the duck. Test your hunch.\n\n")
        (dolist (item '(("Open project" . lemmaduck-open-project)
                        ("Research / writing / assistant" . lemmaduck-research)
                        ("Code with OMP" . lemmaduck-code)
                        ("Resume project" . lemmaduck-resume)
                        ("Task status" . lemmaduck-status)))
          (let ((command (cdr item)))
            (insert-text-button (car item) 'follow-link t
                                'action (lambda (_) (call-interactively command))))
          (insert "\n\n"))
        (insert "In the agent: /ask, /task, /review and /handoff.\n")
        (insert "Terminal: C-c C-j enters line mode; C-c C-k returns to character mode.\n"))
      (special-mode))
    (pop-to-buffer buffer)))

(provide 'lemmaduck)
;;; lemmaduck.el ends here
