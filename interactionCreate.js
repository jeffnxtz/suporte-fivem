const client = require("../../index");
const Discord = require("discord.js");
const { EmbedBuilder } = require("discord.js");
const connect = require("../../Structures/database");
require("dotenv").config();

module.exports = class interactionCreate extends events {
  constructor(...args) {
    super(...args);
    this.event = "interactionCreate";
  }

  exec(interaction) {
    if (interaction.type === Discord.InteractionType.ApplicationCommand) {
      const cmd = client.slashCommands.get(interaction.commandName);
      if (!cmd) return interaction.reply("❌ | Comando não encontrado.");
      interaction["member"] = interaction.guild.members.cache.get(
        interaction.user.id
      );
      cmd.run(client, interaction);
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === "whitelistModal") {
        const characterId =
          interaction.fields.getTextInputValue("characterIdInput");
        const characterName =
          interaction.fields.getTextInputValue("characterNameInput");

        // Verifica se o ID do personagem existe
        connect.query(
          `SELECT * FROM vrp_users WHERE id = '${characterId}'`,
          async (error, rows) => {
            if (error) {
              console.error(error);
              return interaction.reply({
                content:
                  "❌ | Ocorreu um erro ao verificar o ID no banco de dados.",
                ephemeral: true,
              });
            }

            if (rows.length === 0) {
              const embed = new EmbedBuilder()
                .setAuthor({
                  name: "⚠ | Aviso",
                  iconURL: interaction.guild.iconURL(),
                })
                .setDescription(
                  `O ID **${characterId}** não foi localizado.\nCertifique-se de que digitou corretamente ou que o personagem foi criado.`
                )
                .setColor("#FFFFFF")
                .setFooter({
                  text: "Em caso de dúvidas, contate a equipe responsável.",
                });

              return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Verifica se já tem whitelist
            connect.query(
              `SELECT * FROM vrp_users WHERE id = '${characterId}' AND whitelisted = 1`,
              async (error, rows) => {
                if (error) {
                  console.error(error);
                  return interaction.reply({
                    content: "❌ | Erro ao verificar o status da whitelist.",
                    ephemeral: true,
                  });
                }

                if (rows.length > 0) {
                  const embed = new EmbedBuilder()
                    .setAuthor({
                      name: "⚠ | Aviso",
                      iconURL: interaction.guild.iconURL(),
                    })
                    .setDescription(
                      `O ID **${characterId}** já está com whitelist aprovada.\nVerifique se informou o ID correto!`
                    )
                    .setColor("#FFFFFF")
                    .setFooter({
                      text: "Nenhuma ação foi necessária.",
                    });

                  return interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                  });
                }

                // Aprova whitelist
                connect.query(
                  `UPDATE vrp_users SET whitelisted = '1' WHERE id = '${characterId}'`,
                  async (error) => {
                    if (error) {
                      console.error(error);
                      return interaction.reply({
                        content:
                          "❌ | Não foi possível atualizar o status da whitelist.",
                        ephemeral: true,
                      });
                    }

                    // Ajuste de nickname e cargos
                    await interaction.member
                      .setNickname(`${characterId} | ${characterName}`)
                      .catch((err) =>
                        console.error("Erro ao definir apelido:", err)
                      );
                    await interaction.member.roles
                      .add(process.env.idcargoCidadao)
                      .catch((err) =>
                        console.error("Erro ao adicionar cargo:", err)
                      );
                    await interaction.member.roles
                      .remove(process.env.idcargoTurista)
                      .catch((err) =>
                        console.error("Erro ao remover cargo:", err)
                      );

                    const approvedEmbed = new EmbedBuilder()
                      .setAuthor({
                        name: "✅ | Whitelist Aprovada",
                        iconURL: interaction.guild.iconURL(),
                      })
                      .setDescription(
                        "Seu acesso foi autorizado com sucesso e você agora faz parte da cidade.\n" +
                          "**Seja bem-vindo(a) e divirta-se!**"
                      )
                      .addFields(
                        {
                          name: "🆔 | ID",
                          value: `\`\`\`${characterId}\`\`\``,
                          inline: true,
                        },
                        {
                          name: "🏝 | Personagem",
                          value: `\`\`\`${characterName}\`\`\``,
                          inline: true,
                        }
                      )
                      .setImage(process.env.linkImagem || null)
                      .setColor("#2ECC71")
                      .setFooter({
                        text: "Whitelist finalizada com sucesso.",
                        iconURL: interaction.guild.iconURL(),
                      })
                      .setTimestamp();

                    const adminLogEmbed = new EmbedBuilder()
                      .setAuthor({
                        name: "📥 | Registro de Whitelist Aprovada",
                        iconURL: interaction.guild.iconURL(),
                      })
                      .setDescription(
                        `Um novo usuário foi aprovado na whitelist.\n\n` +
                          `**Dados completos do registro:**`
                      )
                      .addFields(
                        {
                          name: "🆔 | ID",
                          value: `\`\`\`${characterId}\`\`\``,
                          inline: true,
                        },
                        {
                          name: "🏝 | Personagem",
                          value: `\`\`\`${characterName}\`\`\``,
                          inline: true,
                        },
                        {
                          name: "👤 | Usuário",
                          value: `<@${interaction.user.id}> ||(\`${interaction.user.tag}\` | \`${interaction.user.id}\`)||`,
                          inline: false,
                        },
                        {
                          name: "📆 | Data da Aprovação",
                          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                          inline: true,
                        }
                      )
                      .setThumbnail(interaction.user.displayAvatarURL())
                      .setImage(process.env.linkImagem || null)
                      .setColor("#3498DB")
                      .setFooter({
                        text: "Sistema de Whitelist • Log de Aprovado",
                      })
                      .setTimestamp();

                    // Envia log para canais
                    const channelLog1 = interaction.guild.channels.cache.get(
                      process.env.idCanalLogsAprovado
                    );
                    if (channelLog1)
                      channelLog1.send({
                        embeds: [adminLogEmbed],
                      });
                    return interaction.reply({
                      embeds: [approvedEmbed],
                      ephemeral: true,
                    });
                  }
                );
              }
            );
          }
        );
      }
    }
  }
};
