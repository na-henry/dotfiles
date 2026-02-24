-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

if vim.fn.executable("lazydocker") == 1 then
  vim.keymap.set("n", "<leader>gd", function()
    Snacks.terminal("lazydocker", { esc_esc = false, ctrl_hjkl = false })
  end, { desc = "Lazydocker" })
end

if vim.fn.executable("lazysql") == 1 then
  vim.keymap.set("n", "<leader>gS", function()
    Snacks.terminal("lazysql", { esc_esc = false, ctrl_hjkl = false })
  end, { desc = "lazysql" })
end
