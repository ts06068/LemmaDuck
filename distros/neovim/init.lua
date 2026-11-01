local root = vim.env.LEMMADUCK_DISTRO_ROOT or vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h")
vim.opt.runtimepath:prepend(root)
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"
vim.opt.mouse = "a"
vim.opt.number = true
vim.opt.termguicolors = true
vim.opt.hidden = true
if vim.env.LEMMADUCK_NVIM_PROFILE == "lazyvim" then
  local profile = root .. "/profiles/lazyvim"
  vim.opt.runtimepath:prepend(profile)
  dofile(profile .. "/init.lua")
else
  vim.cmd.colorscheme("habamax")
end
require("lemmaduck").setup()
