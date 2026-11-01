;;; init.el --- Isolated LemmaDuck starter -*- lexical-binding: t; -*-
(let ((root (file-name-directory (or load-file-name buffer-file-name))))
  (add-to-list 'load-path (expand-file-name "lisp" root)))
(require 'lemmaduck)
(setq inhibit-startup-screen t
      initial-scratch-message nil
      create-lockfiles nil)
(setq lemmaduck-project-directory (or (getenv "LEMMADUCK_PROJECT") default-directory))
(when-let ((program (getenv "LEMMADUCK_EXECUTABLE")))
  (setq lemmaduck-executable program))
(load-theme 'modus-vivendi t)
(lemmaduck-mode 1)
(add-hook 'emacs-startup-hook #'lemmaduck-dashboard)
