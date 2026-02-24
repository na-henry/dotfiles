# dotfiles

Personal macOS development environment configuration focused on terminal-based workflows with vi keybindings and Catppuccin Mocha theming.

## Overview

This repository contains configurations for a modern, keyboard-driven development setup optimized for productivity and aesthetic consistency. All tools share vi/vim keybindings and the Catppuccin Mocha color scheme.

## Tools & Configurations

### Terminal & Shell
- **[Ghostty](https://ghostty.org/)** (`ghostty/`) - Modern, native terminal emulator
- **[Nushell](https://www.nushell.sh/)** (`nushell/`) - Modern shell with structured data pipelines
- **[Starship](https://starship.rs/)** (`starship.toml`) - Minimal, fast prompt with Git and language indicators

### Editor & Multiplexers
- **[Neovim](https://neovim.io/)** (`lazyvim/nvim/`) - Configured with [LazyVim](https://www.lazyvim.org/)
- **[tmux](https://github.com/tmux/tmux)** (`tmux/`) - Terminal multiplexer with vim keybindings
- **[Zellij](https://zellij.dev/)** (`zellij/`) - Alternative terminal multiplexer

### File Management
- **[Yazi](https://yazi-rs.github.io/)** (`yazi/`) - Terminal file manager with lazygit integration

### macOS System Tools
- **[AeroSpace](https://github.com/nikitabobko/AeroSpace)** (`aerospace/`) - Tiling window manager for macOS
- **[Karabiner-Elements](https://karabiner-elements.pqrs.org/)** (`karabiner/`) - Keyboard customization with hyper key layers

## Key Features

- **Unified Vi Keybindings** - hjkl navigation across tmux, Neovim, Yazi, and AeroSpace
- **Catppuccin Mocha Theme** - Consistent color scheme throughout all applications
- **Seamless Integration** - Tmux ↔ Neovim navigation, Yazi ↔ Lazygit workflows
- **Modern Shell Experience** - Nushell with fuzzy search, smart completions, and custom aliases
- **Window Management** - AeroSpace with workspace-specific app assignments
- **Advanced Keyboard Control** - Karabiner hyper key sublayers for system-wide shortcuts

## Installation

These configurations are designed to be symlinked to their respective locations:

```bash
# Clone the repository
git clone https://github.com/yourusername/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Initialize Nushell scripts submodule
git submodule update --init --recursive

# Symlink configurations (adjust as needed)
ln -sf ~/dotfiles/ghostty ~/.config/ghostty
ln -sf ~/dotfiles/nushell ~/.config/nushell
ln -sf ~/dotfiles/lazyvim/nvim ~/.config/nvim
ln -sf ~/dotfiles/tmux ~/.config/tmux
ln -sf ~/dotfiles/yazi ~/.config/yazi
ln -sf ~/dotfiles/zellij ~/.config/zellij
ln -sf ~/dotfiles/aerospace ~/.config/aerospace
ln -sf ~/dotfiles/karabiner ~/.config/karabiner
ln -sf ~/dotfiles/starship.toml ~/.config/starship.toml
```

### Prerequisites

Install the required tools via [Homebrew](https://brew.sh/):

```bash
brew install --cask ghostty karabiner-elements aerospace
brew install nushell starship neovim tmux zellij yazi lazygit
```

### Plugin Managers

- **tmux**: Install [TPM](https://github.com/tmux-plugins/tpm) and run `prefix + I` to install plugins
- **Neovim**: LazyVim will automatically install plugins on first launch

## Nushell Aliases

Common aliases defined in `nushell/config.nu`:

- `lg` - Launch lazygit
- `ld` - Launch lazydocker
- `ls` - Launch lazysql
- `t` - Launch tmux with custom script
- `z` - Launch zellij
- `n` - Launch Neovim

## Customization

Each directory contains tool-specific configurations:

- **Keybindings**: Modify `keymap.toml`, `tmux.conf`, or `config.kdl` files
- **Colors**: Update theme files to switch from Catppuccin Mocha
- **Plugins**: Edit `lazy-lock.json` (Neovim) or `tmux.conf` (tmux)
- **Window Management**: Adjust workspace assignments in `aerospace.toml`

## Theme

All configurations use the **Catppuccin Mocha** color palette:

- Rosewater: `#f5e0dc`
- Flamingo: `#f2cdcd`
- Pink: `#f5c2e7`
- Mauve: `#cba6f7`
- Red: `#f38ba8`
- Maroon: `#eba0ac`
- Peach: `#fab387`
- Yellow: `#f9e2af`
- Green: `#a6e3a1`
- Teal: `#94e2d5`
- Sky: `#89dceb`
- Sapphire: `#74c7ec`
- Blue: `#89b4fa`
- Lavender: `#b4befe`

## License

MIT
