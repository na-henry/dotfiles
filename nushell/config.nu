# EDITOR
$env.config.buffer_editor = "nvim"
$env.config.show_banner = false
$env.config.edit_mode = 'vi'
$env.config.completions.algorithm = "fuzzy"
$env.config.cursor_shape.vi_insert = "blink_underscore"
$env.config.cursor_shape.vi_normal = "blink_block"

# AutoCompletions
source ~/.config/nushell/nu_scripts/custom-completions/git/git-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/docker/docker-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/gh/gh-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/aerospace/aerospace-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/bat/bat-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/ssh/ssh-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/brew/brew-completions.nu
source ~/.config/nushell/nu_scripts/custom-completions/starship/starship-completions.nu

# Modules
source ~/.config/nushell/nu_scripts/modules/fuzzy/fuzzy_history_search.nu
source ~/.config/nushell/nu_scripts/modules/fuzzy/fuzzy_command_search.nu
source ~/.config/nushell/nu_scripts/modules/prompt/starship.nu

# Commands
$env.config.keybindings ++= [{
    name: fuzzy_history
    modifier: control
    keycode: char_r
    mode: [vi_insert, vi_normal, emacs]
    event: { send: executehostcommand cmd: fuzzy-history-search }
}]

# Yazi
def --env y [...args] {
	let tmp = (mktemp -t "yazi-cwd.XXXXXX")
	^yazi ...$args --cwd-file $tmp
	let cwd = (open $tmp)
	if $cwd != $env.PWD and ($cwd | path exists) {
		cd $cwd
	}
	rm -fp $tmp
}

# Aliases
alias lg = lazygit
alias ld = lazydocker
alias t = tmux
alias z = zellij
alias n = nvim

# Env File
source ~/.config/nushell/env.nu

