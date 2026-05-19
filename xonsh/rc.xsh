# Ensure Homebrew and user paths are available
import os as _os
$PATH = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    _os.path.expanduser('~/.local/bin'),
] + $PATH

# xontribs
xontrib load fzf-widgets
$fzf_history_binding = "c-r"  # Ctrl+R → fzf history search

# Gruvbox Dark theme for fzf history search
# Injected directly into popen_args to bypass FZF_DEFAULT_OPTS env issues
import importlib as _il
_fzf = _il.import_module('xontrib.fzf-widgets')
_orig_fzf_history = _fzf.fzf_insert_history
_FZF_COLORS = [
    "--color=bg+:-1,bg:-1,spinner:#fabd2f,hl:#fabd2f",
    "--color=fg:#ebdbb2,header:#fabd2f,info:#fabd2f,pointer:#fabd2f",
    "--color=marker:#fabd2f,fg+:#ebdbb2,prompt:#fabd2f,hl+:#fb4934",
]
def _fzf_history_themed(event):
    import subprocess
    from xonsh.history.main import history_main
    popen_args = [
        _fzf.get_fzf_binary_path(),
        '--read0', '--tac', '--tiebreak=index', '+m',
        '--reverse', '--height=40%', '--bind=ctrl-r:toggle-sort',
    ] + _FZF_COLORS
    if len(event.current_buffer.text) > 0:
        popen_args.append(f'-q ^{event.current_buffer.text}')
    proc = subprocess.Popen(popen_args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, universal_newlines=True)
    history_main(args=['show', '-0', 'all'], stdout=proc.stdin)
    proc.stdin.close()
    proc.wait()
    choice = proc.stdout.read().strip()
    event.cli.renderer.erase()
    if choice:
        event.current_buffer.text = choice
        event.current_buffer.cursor_position = len(choice)
_fzf.fzf_insert_history = _fzf_history_themed

# Carapace completions
execx($(carapace _carapace xonsh))

# Gruvbox gold completion menu theme
$XONSH_STYLE_OVERRIDES = {
    'completion-menu':                                        '#ebdbb2',
    'completion-menu.completion':                             '#ebdbb2',
    'completion-menu.completion.current':                     '#fabd2f bold',
    'completion-menu.meta.completion':                        '#928374',
    'completion-menu.meta.completion.current':                '#fabd2f',
    'completion-menu.completion fuzzymatch.inside':           'bold #fb4934',
    'completion-menu.completion.current fuzzymatch.inside':   'bold #fb4934',
}

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
aliases['ls'] = 'eza -l --icons=auto'
aliases['gd'] = 'gh dash'
aliases['t'] = 'tmux'
aliases['z'] = 'zellij'
aliases['n'] = 'nvim'
aliases['q'] = 'pi --print'
aliases['pir'] = 'pi --resume'
aliases['reload'] = 'source ~/.config/xonsh/rc.xsh'
