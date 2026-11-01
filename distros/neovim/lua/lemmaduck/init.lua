local M = {}
local terminals = {}
local uv = vim.uv or vim.loop

function M.project()
  local path = vim.env.LEMMADUCK_PROJECT or vim.fn.getcwd()
  local info = uv.fs_stat(path)
  assert(info and info.type == "directory", "LemmaDuck project directory is missing")
  return vim.fn.fnamemodify(path, ":p"):gsub("/$", "") .. "/"
end

function M.command(action, project)
  local executable = vim.env.LEMMADUCK_EXECUTABLE or "lemmaduck"
  if action == "research" then return { executable, "agent", project, "--pi" } end
  if action == "code" then return { executable, "code", project } end
  if action == "resume" then return { executable, "agent", project } end
  if action == "status" then return { executable, "status", project } end
  error("Unknown LemmaDuck action: " .. action)
end

function M.start(action)
  local project = M.project()
  local key = project .. "\0" .. action
  local previous = terminals[key]
  if previous and vim.api.nvim_buf_is_valid(previous.buffer)
    and vim.fn.jobwait({ previous.job }, 0)[1] == -1 then
    vim.cmd("botright vsplit")
    vim.api.nvim_win_set_buf(0, previous.buffer)
    vim.cmd("startinsert")
    return
  end
  local argv = M.command(action, project)
  if vim.fn.executable(argv[1]) == 0 then
    vim.notify("Install LemmaDuck and add it to PATH, or set LEMMADUCK_EXECUTABLE", vim.log.levels.ERROR)
    return
  end
  vim.cmd("botright vnew")
  local buffer = vim.api.nvim_get_current_buf()
  local job = vim.fn.termopen(argv, { cwd = project })
  if job <= 0 then error("LemmaDuck failed to start") end
  terminals[key] = { buffer = buffer, job = job }
  vim.bo[buffer].bufhidden = "hide"
  vim.cmd("startinsert")
end

function M.copy_context(first, last)
  local path = vim.api.nvim_buf_get_name(0)
  local text = string.format("%s:%d-%d\n%s", path ~= "" and path or "[unsaved buffer]", first, last,
    table.concat(vim.api.nvim_buf_get_lines(0, first - 1, last, false), "\n"))
  vim.fn.setreg('"', text)
  if vim.fn.has("clipboard") == 1 then pcall(vim.fn.setreg, "+", text) end
  vim.notify("Context copied; paste it into the worker when ready")
  return text
end

function M.dashboard()
  local buffer = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_set_current_buf(buffer)
  vim.bo[buffer].buftype = "nofile"
  vim.bo[buffer].bufhidden = "wipe"
  vim.api.nvim_buf_set_lines(buffer, 0, -1, false, {
    "LemmaDuck Neovim", "Talk to the duck. Test your hunch.", "",
    "r   Research / writing / assistant (Pi)", "c   Code with OMP", "s   Task status",
    "e   Explore project", "q   Close dashboard", "",
    "Commands: :LemmaDuckResearch  :LemmaDuckCode  :LemmaDuckResume",
    "Agent: /ask, /task, /review, /handoff", "Terminal: Ctrl-\\ then Ctrl-N returns to editor mode.",
  })
  vim.bo[buffer].modifiable = false
  for key, action in pairs({ r = "research", c = "code", s = "status" }) do
    vim.keymap.set("n", key, function() M.start(action) end, { buffer = buffer, nowait = true })
  end
  vim.keymap.set("n", "e", "<cmd>Explore<cr>", { buffer = buffer })
  vim.keymap.set("n", "q", "<cmd>bd<cr>", { buffer = buffer })
end

function M.setup()
  for suffix, action in pairs({ Research = "research", Code = "code", Resume = "resume", Status = "status" }) do
    vim.api.nvim_create_user_command("LemmaDuck" .. suffix, function() M.start(action) end, {})
  end
  vim.api.nvim_create_user_command("LemmaDuckContext", function(opts) M.copy_context(opts.line1, opts.line2) end, { range = "%" })
  vim.api.nvim_create_user_command("LemmaDuck", M.dashboard, {})
  vim.keymap.set("n", "<leader>ar", "<cmd>LemmaDuckResearch<cr>", { desc = "LemmaDuck research" })
  vim.keymap.set("n", "<leader>ac", "<cmd>LemmaDuckCode<cr>", { desc = "LemmaDuck code" })
  vim.keymap.set("n", "<leader>as", "<cmd>LemmaDuckStatus<cr>", { desc = "LemmaDuck status" })
  vim.keymap.set("v", "<leader>ay", ":LemmaDuckContext<cr>", { desc = "Copy selected context" })
  if vim.fn.argc() == 0 and #vim.api.nvim_list_uis() > 0 then M.dashboard() end
end

return M
