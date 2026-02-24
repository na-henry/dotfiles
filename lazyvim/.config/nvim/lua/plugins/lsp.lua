-- ~/.config/nvim/lua/plugins/lsp-config.lua

return {
  -- This ensures we're modifying the nvim-lspconfig plugin
  "neovim/nvim-lspconfig",
  opts = {
    servers = {
      -- Add or ensure this entry exists for docker-compose-language-service
      docker_compose_language_service = {
        filetypes = { "yaml", "yaml.docker-compose", "dockercompose" },
        settings = {}, -- Leave empty if no specific settings are needed
      },

      bashls = {
        -- Only allow bashls to attach to these explicit filetypes
        -- Common shell script filetypes:
        filetypes = { "sh", "bash", "zsh" }, -- Exclude "dotenv" or generic "conf" if they were there
        -- *** This is the crucial part: Override the 'globPattern' setting ***
        settings = {
          bashIde = {
            -- Set a globPattern that explicitly excludes .env files,
            -- or only includes typical shell script extensions.
            -- This overrides the default globPattern you saw in :LspInfo.
            globPattern = "*.{sh,bash,zsh}", -- Only include standard shell extensions
            -- You could also try: globPattern = "!*.env*" -- if the server supports negative globs, but it's safer to be explicit
          },
        },
        -- You can also use a "root_dir" check if you only want it active in specific project types.
        -- Or if bashls has a specific option to exclude certain patterns, you'd put it in 'settings'.
        -- However, 'filetypes' is the most direct way to control this from nvim-lspconfig.
      },

      -- OPTIONAL: If you want to ensure yamlls is also configured with Docker Compose schema
      yamlls = {
        settings = {
          yaml = {
            schemas = {
              ["https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json"] = {
                "docker-compose*.yml",
              },
            },
          },
        },
      },
    },
  },
  -- If you use Mason's ensure_installed for servers, you can also add it here:
  -- ensure_installed = { "docker_compose_language_service" },
}
