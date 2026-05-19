# Autocompletions
fpath=(/opt/homebrew/share/zsh/site-functions $fpath)
autoload -Uz compinit
compinit

# PATH
path+=("/Users/nathan/.cargo/bin/")
path+=("/opt/homebrew/bin")
path+=("$HOME/.local/bin")
export PATH

# Carapace completions
source <(carapace _carapace zsh)

# Editor
export EDITOR="zed"

# Gruvbox Dark fzf theme (Ctrl+R history)
export FZF_DEFAULT_OPTS="
  --color=bg+:-1,bg:-1,spinner:#fabd2f,hl:#fabd2f
  --color=fg:#ebdbb2,header:#fabd2f,info:#fabd2f,pointer:#fabd2f
  --color=marker:#fabd2f,fg+:#ebdbb2,prompt:#fabd2f,hl+:#fb4934
  --reverse --height=40% --bind=ctrl-r:toggle-sort
"

# Starship prompt
eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship.toml

# fzf
source <(fzf --zsh)

# eza — make unset permission bits (dashes) visible in iTerm2
export EZA_COLORS="xx=38;5;240"

# Aliases
alias lg="lazygit -ucd ~/.config/lazygit"
alias ld="lazydocker"
alias ls="eza -l --icons=auto"
alias gd="gh dash"
alias t="tmux"
alias z="zellij"
alias n="nvim"
alias q="pi --print"
alias pir="pi --resume"
alias reload="source ~/.zshrc"

# yazi — cd to last directory on quit (y)
function y() {
  local tmp="$(mktemp -t "yazi-cwd.XXXXXX")"
  yazi "$@" --cwd-file="$tmp"
  if cwd="$(cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
    builtin cd -- "$cwd"
  fi
  rm -f -- "$tmp"
}

# yazi — cd to last directory on quit (c)
function c() {
  local tmp="$(mktemp -t "yazi-cwd.XXXXXX")"
  yazi "$@" --cwd-file="$tmp"
  if cwd="$(cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
    builtin cd -- "$cwd"
  fi
  rm -f -- "$tmp"
}

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"
