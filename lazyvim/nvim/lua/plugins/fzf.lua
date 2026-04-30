return {
  "ibhagwan/fzf-lua",
  opts = {
    files = {
      fd_opts = "--hidden --no-ignore --color=never --type f --type l --exclude .git --exclude .jj",
    },
    grep = {
      rg_opts = "--hidden --no-ignore --column --line-number --no-heading --color=always --smart-case --max-columns=4096 -e",
    },
  },
}
