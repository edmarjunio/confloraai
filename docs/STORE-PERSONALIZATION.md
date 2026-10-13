# Personalização e guia de compras

Na loja principal, acesse `/configuracoes` ou **Admin → Personalizar loja** usando uma conta ADMIN. Nas lojas SaaS, use `/shop/<slug>/admin`.

O formulário permite definir nome, segmento, região, logo (arquivo PNG/JPEG/WebP ou URL HTTPS), ícone, quatro cores, categorias, PIX, logística, contato e modo de atendimento. A logo enviada é redimensionada no navegador e armazenada na configuração da própria loja. As cores são aplicadas por variáveis CSS; catálogo, sacola, chat e painel recebem a identidade cadastrada.

O modo **Guia por categorias** não chama o Gemini. Ele usa categorias e subcategorias dos produtos ativos, mostra os resultados em grupos de seis com “Mostrar mais”, permite adicionar à sacola e consultar descrição, especificações e orientações cadastradas. Não cria recomendações técnicas quando não existem dados. Na loja principal, as categorias vêm do cadastro/importação; categorias novas passam a integrar a configuração. Nos tenants, cadastre as categorias no painel antes de vinculá-las aos produtos.

Sinônimos são cadastrados por loja, um grupo por linha, separados por vírgula, por exemplo `mandioca, aipim, macaxeira`. Tags e nomes alternativos dos produtos também participam da busca. A busca tolera erros curtos, mas mantém números de tamanho/modelo exatos e apresenta correspondências aproximadas para confirmação. As categorias de produtos não são inferidas por IA nem por regras fixas de um segmento.

O modo **Consultoria por IA** mantém a integração existente, persona, instruções e busca externa. Ativá-lo exige credenciais e cota disponíveis no provedor. Trocar o modo recarrega a página para não manter eventos do chat anterior.

Configurações do tenant são isoladas em `stores/<tenant>/publicConfig` e `privateConfig`. A loja principal preserva sua base existente e guarda a personalização em `store_settings/storefront`. Ambos verificam a versão ao salvar para impedir sobrescritas concorrentes. As rotas de escrita exigem ADMIN.

O painel operacional legado continua na loja principal para preservar caixa, importação e estoque. Integrações por webhook pertencem ao painel SaaS. A Conflora é apenas o perfil inicial da base existente; novas lojas usam a configuração genérica e seus próprios dados.
