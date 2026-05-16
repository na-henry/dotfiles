# Starship prompt
execx($(starship init xonsh))
$TITLE = '{cwd}'

$XONSH_COLOR_STYLE = 'nord-darker'

# Yazi wrapper — changes cwd to wherever you quit yazi
def _yazi_cd(args, stdin=None):
    """Launch yazi and cd to the directory you quit from."""
    import tempfile, os, subprocess
    tmp = tempfile.mktemp(prefix='yazi-cwd-')
    try:
        with open('/dev/tty', 'rb') as tty_in, open('/dev/tty', 'wb') as tty_out:
            subprocess.run(['yazi'] + args[1:] + ['--cwd-file', tmp],
                          stdin=tty_in, stdout=tty_out, stderr=tty_out)
        if os.path.exists(tmp):
            cwd = open(tmp).read().strip()
            if cwd and cwd != os.getcwd():
                cd @(cwd)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)

aliases['c'] = _yazi_cd

# Aliases
aliases['y'] = 'yazi'
aliases['lg'] = 'lazygit -ucd ~/.config/lazygit'
aliases['ld'] = 'lazydocker'
aliases['ls'] = 'eza -f --icons'
aliases['gd'] = 'gh dash'
aliases['t'] = 'tmux'
aliases['z'] = 'zellij'
aliases['n'] = 'nvim'
aliases['q'] = 'pi --print'
aliases['pir'] = 'pi --resume'
aliases['reload'] = 'source ~/.config/xonsh/rc.xsh'
