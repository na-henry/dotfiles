return {
  "ibhagwan/fzf-lua",
  opts = function(_, opts)
    local actions = require("fzf-lua").actions
    opts.files = vim.tbl_deep_extend("force", opts.files or {}, {
      fd_opts = "--hidden --no-ignore --color=never --type f --type l --exclude .git --exclude .jj --exclude node_modules --exclude vendor",
      actions = {
        ["ctrl-g"] = { actions.toggle_hidden },
        ["ctrl-y"] = { actions.toggle_ignore },
        ["alt-h"] = false,
        ["alt-i"] = false,
      },
    })
    opts.grep = vim.tbl_deep_extend("force", opts.grep or {}, {
      rg_opts = "--hidden --no-ignore --column --line-number --no-heading --color=always --smart-case --max-columns=4096 -e",
      rg_glob = true,
      actions = {
        ["ctrl-g"] = { actions.toggle_hidden },
        ["ctrl-y"] = { actions.toggle_ignore },
        ["alt-h"] = false,
        ["alt-i"] = false,
      },
    })
    return opts
  end,
}
