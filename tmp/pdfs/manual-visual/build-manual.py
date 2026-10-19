from pathlib import Path
from xml.sax.saxutils import escape
import json, re
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
ASSETS=ROOT/'tmp/pdfs/manual-visual'
OUT=ROOT/'output/pdf/manual-visual-equipe-conflora.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('CF','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('CFBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('CF',normal='CF',bold='CFBold',italic='CF',boldItalic='CFBold')
W,H=A4
G=colors.HexColor('#109e46');D=colors.HexColor('#0f381e');Y=colors.HexColor('#f5c400');T=colors.HexColor('#1e293b');M=colors.HexColor('#64748b');BG=colors.HexColor('#f4f6f5');B=colors.HexColor('#dce5df')
LOGO=ROOT/'public/storefront/brands/conflora-logo.png'
CAPTURES=json.loads((ASSETS/'captures.json').read_text(encoding='utf-8'))
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('Conflora | Manual visual da equipe');c.setAuthor('Conflora Horta e Viveiro');c.setSubject('Operação por função, com telas e fluxos de Pix manual')
PAGES=[]
def add(group,title,route,shot,steps,result,attention='',caption='Tela demonstrativa. Produtos, clientes e valores são exemplos.'):
 PAGES.append(dict(group=group,title=title,route=route,shot=shot,steps=steps,result=result,attention=attention,caption=caption))
add('COMECE AQUI','Entrar com sua própria conta','Acesso da equipe > Caixa','login',[
 ('Escolha seu usuário','Selecione seu nome na lista. Cada pessoa deve trabalhar na própria conta.'),('Informe seu PIN','Digite o PIN pessoal e toque em Entrar.'),('Confira a identificação','Antes de vender, veja se o cabeçalho mostra seu nome e a função correta.'),('Encerre sua sessão','Ao trocar de operador ou entregar o aparelho, use Sair. O próximo colega entra com a própria conta.')], 'Seu nome e sua função aparecem no cabeçalho.', 'Não compartilhe o PIN. Se não conseguir entrar, peça ajuda ao Admin.')
add('COMECE AQUI','Encontrar qualquer página','Página inicial > Menu de três linhas','menu',[
 ('Abra o menu','Toque no ícone de três linhas, no canto superior direito.'),('Escolha a área','Caixa, Comandas, Entregas e outras páginas aparecem conforme seu cargo.'),('Volte ou troque de área','Use Voltar para retornar. Para mudar de área, abra o menu novamente.'),('Saia com segurança','O botão vermelho Sair encerra a sua sessão. A seta da sacola apenas recolhe a sacola.')], 'Você chega à área desejada sem procurar por várias abas.', 'Se um atalho não aparecer, confirme sua função com o Admin.')
add('CAIXA','Montar uma venda no balcão','Menu > Caixa','caixa',[
 ('Localize o produto','Use a busca ou a categoria. Toque no produto para colocá-lo na sacola.'),('Confira a sacola à direita','Ajuste a quantidade com + e -. Confira os itens e remova o que entrou por engano.'),('Atenção a UN e KG','UN é quantidade de unidades. Em KG, informe o peso medido e confira o total.'),('Revise antes de cobrar','Confira cliente, balcão ou entrega e valor final. Depois toque em PAGAR - F1.')], 'A sacola contém exatamente os produtos e quantidades combinados.', 'Não finalize com preço ou estoque divergente. Chame o responsável.')
add('CAIXA','Identificar o cliente','Caixa > Adicionar cliente','cliente',[
 ('Procure antes de cadastrar','Use BUSCAR CLIENTE para encontrar um cadastro existente.'),('Confira quem está comprando','Confirme nome e telefone com DDD. E-mail vincula o cadastro à conta do cliente.'),('Complete os dados necessários','Fiado e crédito precisam de cliente cadastrado. Entrega exige endereço completo.'),('Salve e confira','Toque em Adicionar cliente. O nome deve aparecer na sacola.')], 'A venda fica associada ao cliente correto.', 'Só preencher o nome faz uma compra rápida; isso não cria um cadastro completo.')
add('CAIXA','Receber dinheiro ou cartão','Caixa > PAGAR - F1','pagamento',[
 ('Confira o total','Leia o total a receber e confirme o nome do cliente.'),('Escolha a forma real','Dinheiro, Cartão de débito ou Cartão de crédito.'),('Confira o recebimento','Em dinheiro, informe o valor recebido e devolva o troco. Em cartão, aguarde a aprovação da máquina.'),('Finalize uma vez','Toque em Finalizar venda e espere o recibo. Use Nova venda para o próximo atendimento.')], 'A tela mostra Venda finalizada e o pagamento confirmado.', 'Se a tela demorar, consulte a comanda antes de cobrar ou registrar novamente.')
add('CAIXA','Dividir um pagamento','Pagamento > Usar mais de uma forma de pagamento','pagamento-dividido',[
 ('Ative a divisão','Marque Usar mais de uma forma de pagamento.'),('Distribua os valores','Informe cada forma e o valor correspondente. A soma deve ser igual ao total.'),('Confira cada parcela','Confirme dinheiro e cartão. Uma parcela Pix manual exige conferência; uma parcela fiada gera dívida.'),('Conclua a operação','Use Confirmar pagamentos quando os valores estiverem corretos e acompanhe as pendências exibidas.')], 'Cada parcela fica registrada com a forma e o valor corretos.', 'Não marque Pix como dinheiro para conseguir concluir a venda.')
add('CAIXA','Registrar um Pix no balcão','Pagamento > Pix · conferência do caixa','pix-balcao',[
 ('Escolha Pix','Selecione Pix · conferência do caixa.'),('Registre a pendência','Toque em Registrar Pix pendente. O pedido ainda não está pago.'),('Oriente o cliente','Mostre a chave da loja e o beneficiário na comanda. Peça o comprovante após o pagamento.'),('Passe à conferência','Abra a comanda e siga a próxima página. O Caixa ou Admin confirma o crédito no banco.')], 'O pedido fica pendente até a conferência do pagamento.', 'O Pix automático do Sicredi ainda não faz parte deste procedimento.')
add('CAIXA','Conferir e confirmar o Pix','Comandas > Abrir recibo e detalhes','pix-conferencia',[
 ('Abra o comprovante','Use Ver comprovante enviado pelo cliente. Confira também o valor da parcela Pix.'),('Confira no banco','Verifique se o dinheiro entrou na conta da empresa, com o valor e beneficiário corretos. Agendamento não é recebimento.'),('Registre a conferência','Marque a caixa de confirmação e escreva uma observação clara.'),('Confirme ou recuse','Se estiver correto, use Confirmar recebimento Pix. Se estiver errado, informe o motivo e use Recusar comprovante.')], 'Após confirmar, confira o novo estado da comanda e o recibo.', 'Comprovante enviado não significa pagamento confirmado. Nunca aprove só pela imagem.')
add('CAIXA','Acompanhar as comandas','Caixa > Comandas / F2','comandas',[
 ('Encontre o pedido','Localize pelo cliente ou identificador da comanda.'),('Abra os detalhes','Confira produtos, quantidades, total e forma de pagamento.'),('Leia a etapa','Esperando confirmação: conferir o pedido. Esperando pagamento: receber. Pagos/finalizados: consultar. Fiados: acompanhar a dívida.'),('Avance apenas após conferir','Use a ação disponível dentro do pedido. Pix, entrega e fiado têm regras próprias.')], 'Cada pedido fica na etapa correspondente à situação real.', 'Antes de refazer uma venda, procure por ela nas comandas e no histórico.')
add('CAIXA','Desconto e venda fiada','Caixa > Desconto / F4 ou Pagamento > Fiado','desconto',[
 ('Combine o desconto','Abra F4 e informe o percentual autorizado. Confira o novo total.'),('Aguarde a aprovação','Descontos acima de 5% solicitados por Caixa ou Vendedor dependem do Admin.'),('No fiado, identifique o cliente','Selecione um cadastro existente e escolha Fiado · aprovação do Admin.'),('Encaminhe a comanda','Acompanhe o pedido e siga a decisão administrativa antes de liberar a operação.')], 'A condição comercial fica registrada e pode ser conferida.', 'Fiado aprovado é dívida do cliente; não é dinheiro recebido.')
add('CAIXA','Receber uma dívida ou crédito','Relatório / F3 > Receber pagamento','receber',[
 ('Selecione o cadastro certo','Busque o cliente e confira nome, saldo devedor e crédito disponível.'),('Escolha o lançamento','Receber pagamento de dívida quita fiado. Adicionar crédito antecipado registra valor pago para uso futuro.'),('Informe o que recebeu','Escolha valor e forma. No Pix, anexe comprovante, confira o banco e registre a observação.'),('Confira o novo saldo','Confirme o recebimento e leia o resultado. Recebimento parcial mantém o restante em aberto.')], 'O saldo do cliente é atualizado e o recebimento fica registrado.', 'Não crie venda fictícia para quitar uma dívida antiga.')
add('CAIXA','Consultar recibos e relatório','Caixa > Histórico / F9 ou Relatório / F3','relatorio',[
 ('Escolha o período','Confira a data e os filtros antes de analisar os valores.'),('Revise seus recebimentos','Compare dinheiro, Pix, cartões, quitações e valores ainda pendentes.'),('Abra o histórico quando precisar','F9 permite localizar uma venda anterior e conferir seus detalhes.'),('Termine o turno','Entregue os valores e pendências ao responsável. Use Sair ao deixar o posto.')], 'O responsável recebe os valores e uma lista clara de pendências.', 'O relatório do turno não substitui o fechamento diário feito pelo Admin.')
add('VENDEDOR','Montar e encaminhar a venda','Menu > Caixa','vendedor',[
 ('Monte a sacola','Inclua os produtos, confira UN ou KG e combine o total com o cliente.'),('Identifique o atendimento','Informe o cliente. Se for entrega, confira telefone, endereço e referência.'),('Respeite as aprovações','Solicite desconto ou fiado quando necessário e acompanhe a resposta do Admin.'),('Envie ao Caixa','Use Enviar comanda ao caixa. Informe o identificador do pedido ao cliente e ao operador.')], 'O Caixa encontra a mesma comanda e continua o atendimento.', 'Não monte uma segunda venda para substituir uma comanda que já foi enviada.')
add('ENTREGADOR','Assumir e separar o pedido','Menu > Entregas','entrega-assumir',[
 ('Abra uma entrega disponível','Confira cliente, endereço, itens e situação do pagamento.'),('Assuma a responsabilidade','Toque em Assumir e separar pedido.'),('Confira a separação','Verifique produto, quantidade e condições antes de carregar.'),('Se não puder seguir','Use Devolver à fila de entregas e avise o responsável.')], 'O pedido fica vinculado a quem vai fazer a entrega.', 'WhatsApp é um aviso. Confirme a situação atual dentro do site.')
add('ENTREGADOR','Registrar a saída da horta','Entregas > Pedido assumido','entrega-saida',[
 ('Confira se está tudo pronto','Produtos separados, endereço confirmado e pagamento entendido.'),('Registre a saída','Ao sair de verdade, toque em Saí da horta · iniciar entrega.'),('Abra a navegação','Use Abrir no Google Maps ou Abrir no Waze. Se necessário, ligue para o cliente.'),('Siga com o pedido correto','Confira o nome e endereço antes de entregar os produtos.')], 'A entrega passa para Em rota e a saída fica registrada.', 'Não registre a saída enquanto o pedido ainda estiver sendo separado.')
add('ENTREGADOR','Entregar e concluir a rota','Entregas > Pedido em rota','entrega-concluir',[
 ('Confira a situação financeira','Se já estiver pago, não cobre novamente. Se for a receber, registre somente o que realmente recebeu.'),('Para Pix manual, chame o Caixa','A conferência bancária do Pix manual cabe ao Caixa ou Admin.'),('Registre o percurso, se usar','Preencha os quilômetros reais no campo opcional.'),('Conclua no momento certo','Após entregar e resolver o pagamento, toque em Confirmar entrega.')], 'O pedido aparece entre os finalizados/entregues.', 'Se houver recusa, endereço errado ou falta de pagamento, não conclua: avise o responsável.')
add('ADMIN / PRODUTOS','Cadastrar e atualizar produtos','Menu > Produtos','produto',[
 ('Abra o cadastro','Use ADICIONAR PRODUTO para um item novo ou abra um produto existente.'),('Confira os dados de venda','Nome, categoria, unidade e preço. Em KG, o preço é por quilograma.'),('Adicione informações úteis','Inclua fotos reais e detalhes que ajudem cliente e equipe a identificar o item.'),('Salve e confira a vitrine','Verifique o produto no catálogo e no Caixa. Para retirar temporariamente da venda, use INATIVO.')], 'O cadastro apresenta o produto com o preço e a unidade corretos.', 'Movimente estoque pela tela própria para manter o histórico da operação.')
add('ADMIN / PRODUTOS','Importar a planilha de produtos','Produtos > Importar planilha de produtos','importacao',[
 ('Use o modelo','Baixe o CSV, preencha uma linha por produto e salve como CSV UTF-8. JSON também é aceito.'),('Mantenha o código estável','Preencha código, nome, preço, categoria, unidade e estoque. Preserve zeros à esquerda.'),('Confira a prévia','Envie o arquivo e use Validar e mostrar prévia. Corrija qualquer erro antes de continuar.'),('Confirme e verifique','Use Confirmar importação, aguarde a mensagem final e confira os produtos no Caixa.')], 'Os produtos novos aparecem no cadastro com os valores importados.', 'Limite: 2.000 produtos e 1 MB. Se interromper, reenvie o mesmo arquivo para retomar sem duplicar.')
add('ADMIN / ESTOQUE','Registrar entrada e contagem','Menu > Estoque','estoque-contagem',[
 ('Escolha o produto','Confira o nome e a unidade antes de lançar quantidade.'),('Entrada: some o que chegou','Use o modo de entrada e registre somente a mercadoria recebida.'),('Contagem: informe o saldo real','Use Conferir o que tenho e digite a quantidade que contou fisicamente.'),('Salve e confira','Revise o saldo final e o histórico de movimentações.')], 'O saldo no sistema corresponde à movimentação realizada.', 'Contagem substitui o saldo; ela não soma a quantidade informada.')
add('ADMIN / ESTOQUE','Registrar perda, baixa ou ajuste','Estoque > Baixa ou ajuste com motivo','estoque-ajuste',[
 ('Abra a movimentação','Localize o item e use Baixa ou ajuste com motivo.'),('Confira operação e quantidade','Verifique se está fazendo a entrada, saída ou ajuste correto.'),('Escreva o motivo real','Exemplo: perda por avaria ou correção após conferência física.'),('Confirme o resultado','Salve e confira o saldo e o registro no histórico.')], 'A diferença fica registrada com uma justificativa consultável.', 'Não use uma venda fictícia para corrigir o estoque.')
add('ADMIN / EQUIPE','Cadastrar e orientar a equipe','Menu > Equipe > Novo Funcionário','equipe-cadastro',[
 ('Cadastre cada pessoa','Informe nome, e-mail, cargo e PIN pessoal.'),('Escolha a função adequada','Admin, Caixa, Vendedor ou Entregador. Estoque é uma responsabilidade de uma conta administrativa autorizada.'),('Confirme o acesso','Salve e peça à pessoa para entrar. Confira nome, função e os atalhos disponíveis.'),('Mantenha a equipe atualizada','Quando alguém sair, remova ou desative o acesso e confira a lista.')], 'Cada pessoa usa a própria conta e vê as áreas permitidas.', 'Não distribua a conta Admin para toda a equipe.')
add('ADMIN / APROVAÇÕES','Decidir sobre desconto e fiado','Avisos / Comandas > Pedido pendente','comandas',[
 ('Abra a solicitação','Confira cliente, produtos, valor, operador e o motivo da condição pedida.'),('Decida sobre o desconto','Aprove apenas o percentual autorizado. Se recusar, informe um motivo claro.'),('No fiado, confira o cadastro','Siga a política da empresa e confira a situação do cliente antes de aprovar.'),('Oriente a continuidade','Depois da aprovação, o Caixa segue as etapas do pedido e dos pagamentos.')], 'A comanda registra a decisão e a equipe sabe como continuar.', 'Aprovação de fiado registra dívida; não representa entrada de dinheiro.')
add('ADMIN / GESTÃO','Ler os números da loja','Menu > Painel Gerencial','gerencial',[
 ('Escolha o período','Use o mês, a semana, o ano ou as datas disponíveis.'),('Compare os principais valores','Vendas registradas, dinheiro recebido e valor fiado têm significados diferentes.'),('Confira a comparação','Observe o período anterior indicado na tela antes de concluir se houve crescimento.'),('Investigue as diferenças','Use os detalhes por forma de pagamento e por produto.')], 'Você acompanha os resultados do período que realmente selecionou.', 'Faturamento não é lucro. Uma venda pode ser feita num mês e recebida em outro.')
add('ADMIN / GESTÃO','Entender a venda de cada mês','Painel Gerencial > O que mais vende em cada mês?','mensal',[
 ('Escolha o ano','Use o campo Ano do histórico mensal.'),('Leia mês a mês','Confira o total vendido e a comparação anual exibida.'),('Observe os líderes','Veja o produto que lidera em quantidade e o que lidera em valor em cada mês.'),('Use o histórico para planejar','Combine os resultados com disponibilidade, estoque e época do ano.')], 'Você identifica a sazonalidade registrada nas vendas da loja.', 'Mês sem registro não é previsão de venda e não comprova falta de procura.')
add('ADMIN / GESTÃO','Comparar produtos que vendem','Painel Gerencial > Rankings de produtos','rankings',[
 ('Confira o período','Os rankings acompanham o filtro selecionado no painel.'),('Escolha a unidade','Separe quilos e unidades quando comparar quantidade.'),('Leia os quatro rankings','Mais e menos vendidos em quantidade; mais e menos vendidos em valor.'),('Confira itens sem venda','Antes de decidir, veja se o produto estava ativo e disponível em estoque.')], 'A análise distingue volume vendido de valor vendido.', 'Não compare 1 kg com 1 unidade como se fossem a mesma medida.')
add('ADMIN / GESTÃO','Conferir e fechar o dia','Painel Gerencial > Fechamento e detalhes do dia','fechamento',[
 ('Confira a data','Abra Fechamento e detalhes do dia e escolha o dia correto.'),('Concilie os valores','Compare dinheiro físico, extrato Pix e cartões com o sistema. Confira quitações e créditos separadamente.'),('Resolva as divergências','Revise com o operador e baixe o relatório quando precisar conferir os detalhes.'),('Registre uma vez','Use Registrar fechamento e aguarde. O relatório segue para a fila de envio ao Júnior.')], 'O fechamento fica registrado com os valores conferidos.', 'Se o WhatsApp não chegar, consulte o estado no site; não feche o mesmo dia novamente.')
add('ADMIN / SUPORTE','Consultar o histórico de erros','Menu > Sistema e erros','admin-status',[
 ('Abra a área de acompanhamento','Use Sistema e erros no menu.'),('Atualize o histórico','Toque em Atualizar histórico para consultar as falhas registradas.'),('Anote o contexto','Horário, operação e identificador da requisição, quando houver.'),('Encaminhe ao suporte','Explique o que estava fazendo e a mensagem exibida. Se o site inteiro cair, avise o responsável técnico.')], 'O suporte recebe informações úteis para localizar a falha.', 'Não envie PIN, senha, token ou comprovantes de clientes em grupos públicos.')
add('ADMIN / LOJA','Personalizar a loja e acompanhar acesso','Menu > Personalizar minha loja / Eventos','personalizar',[
 ('Abra a personalização','Revise identidade visual, nome, cores e informações exibidas ao cliente.'),('Faça alterações com atenção','Confira os campos e salve usando a ação indicada na página.'),('Verifique a vitrine','Abra a página inicial e confira o resultado no computador e no celular.'),('Consulte os Eventos','A área Eventos mostra registros de interação do site; use-a para entender o uso da loja.')], 'A identidade da Conflora fica coerente em toda a vitrine.', 'Eventos de navegação não substituem o relatório financeiro de vendas.')
add('TODAS AS FUNÇÕES','Perfil, avisos e saída','Menu > Editar meu perfil','perfil',[
 ('Confira seus dados','Abra Editar meu perfil e mantenha as informações pessoais corretas.'),('Salve as alterações','Confira a confirmação antes de fechar a tela.'),('Acompanhe os avisos','O sino e a quantidade destacada indicam avisos ainda não lidos. Abra para consultar o conteúdo.'),('Encerre a sessão','Use o botão vermelho Sair antes de entregar o aparelho a outra pessoa.')], 'Seus dados ficam atualizados e as pendências são consultadas.', 'Alteração de função e acesso deve ser feita pelo Admin na Equipe.')
add('CLIENTE / ORIENTAÇÃO','Comprar no catálogo','Página inicial > Produtos > Sacola','sacola',[
 ('Escolha os produtos','Busque o item e adicione à sacola. Confira quantidade e unidade.'),('Informe os dados','Preencha nome e telefone. Escolha retirada ou entrega e complete o endereço quando solicitado.'),('Revise e envie','Confira itens, total e forma de pagamento antes de confirmar o pedido.'),('Guarde o acompanhamento','Use o link do pedido para consultar o andamento e enviar comprovante.')], 'O pedido aparece no acompanhamento e pode ser atendido pela loja.', 'O link do pedido é privado. Não compartilhe em grupos públicos.')
add('CLIENTE / ORIENTAÇÃO','Pagar com Pix e enviar comprovante','Acompanhamento do pedido','pix-cliente',[
 ('Copie a chave no site','Use Copiar chave Pix e confira o beneficiário no aplicativo do banco.'),('Faça o pagamento','Confira o valor do pedido ou da parcela Pix antes de concluir no banco.'),('Envie o comprovante','Selecione foto ou PDF e toque em Enviar comprovante.'),('Aguarde a conferência','A loja verifica o recebimento. Se houver recusa, leia o motivo e envie o arquivo correto.')], 'O site informa que o comprovante aguarda conferência.', 'Chave e valores da imagem são demonstrativos. Sempre use a chave exibida no site em operação.')
add('CLIENTE / ORIENTAÇÃO','Buscar ajuda e acompanhar compras','Página inicial > Assistente / Minha conta','assistente',[
 ('Use a busca ou o assistente','Digite o produto que procura. Enter envia a mensagem e Esc limpa o campo.'),('Confira antes de comprar','As sugestões ajudam a localizar itens. Preço e estoque são conferidos ao finalizar o pedido.'),('Consulte sua conta','Abra Minha conta para consultar compras e informações disponíveis do cadastro.'),('Para quitar dívida','Fale com a loja e aguarde o recebimento ser registrado pelo Caixa.')], 'O cliente encontra produtos e acompanha o próprio atendimento.', 'Uma resposta do assistente não confirma pagamento nem reserva uma venda.')


def para(text,x,top,width,size=10.5,color=T,bold=False,leading=None):
 style=ParagraphStyle('x',fontName='CFBold' if bold else 'CF',fontSize=size,leading=leading or size*1.38,textColor=color)
 p=Paragraph(text,style);_,h=p.wrap(width,900);p.drawOn(c,x,top-h);return top-h

def image_fit(path,x,top,w,h):
 iw,ih=Image.open(path).size;r=min(w/iw,h/ih);dw=iw*r;dh=ih*r;ix=x+(w-dw)/2;iy=top-dh
 c.setStrokeColor(B);c.setFillColor(colors.white);c.roundRect(ix-2,iy-2,dw+4,dh+4,9,fill=1,stroke=1)
 c.drawImage(str(path),ix,iy,dw,dh,mask='auto')
 meta=CAPTURES.get(Path(path).stem,{})
 for mark in meta.get('pins',[]):
  if 'width' not in mark:continue
  sx=dw/meta['width'];sy=dh/meta['height']
  c.setStrokeColor(Y);c.setLineWidth(2)
  c.roundRect(ix+mark['x']*sx-2,iy+dh-(mark['y']+mark['height'])*sy-2,mark['width']*sx+4,mark['height']*sy+4,4,fill=0,stroke=1)
 c.setLineWidth(1)
 return ix,iy,dw,dh

def header(group,title,num):
 c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0)
 c.drawImage(str(LOGO),39,H-53,104,29,preserveAspectRatio=True,mask='auto')
 c.setFillColor(G);c.roundRect(W-189,H-48,150,20,10,fill=1,stroke=0)
 c.setFillColor(colors.white);c.setFont('CFBold',8);c.drawCentredString(W-114,H-41,'GUIA VISUAL DA EQUIPE')
 c.setStrokeColor(B);c.line(39,H-64,W-39,H-64)
 para(group,40,H-83,510,8.5,G,True)
 end=para(title,40,H-102,510,23,D,True,27)
 return end-12

def footer(num):
 c.setStrokeColor(B);c.line(40,40,W-40,40)
 c.setFillColor(M);c.setFont('CF',7.5);c.drawString(40,26,'CONFLORA  |  Pix manual  |  Telas demonstrativas')
 c.drawRightString(W-40,26,str(num).zfill(2));c.setFillColor(G);c.drawRightString(W-72,26,'Índice')
 c.linkAbsolute('Voltar ao índice','indice',Rect=(W-110,20,W-65,37),thickness=0)

def step(title,body,n,x,top,width):
 c.setFillColor(G);c.circle(x+10,top-10,10,fill=1,stroke=0);c.setFillColor(colors.white);c.setFont('CFBold',10);c.drawCentredString(x+10,top-13.4,str(n))
 y=para(escape(title),x+29,top,width-29,11,D,True,14)
 return para(escape(body),x+29,y-4,width-29,10.4,T,False,14.3)-14

def note(title,body,x,top,width,tone='green'):
 fill=colors.HexColor('#e5f4eb') if tone=='green' else colors.HexColor('#fff7d6')
 p=Paragraph('<b>'+escape(title)+'</b> '+escape(body),ParagraphStyle('note',fontName='CF',fontSize=9.5,leading=13,textColor=D))
 _,h=p.wrap(width-24,300);c.setFillColor(fill);c.roundRect(x,top-h-22,width,h+22,10,fill=1,stroke=0);p.drawOn(c,x+12,top-11-h);return top-h-32

# Capa
c.setFillColor(D);c.rect(0,0,W,H,fill=1,stroke=0)
c.setFillColor(G);c.circle(W+70,H-155,205,fill=1,stroke=0);c.setFillColor(Y);c.circle(W-33,H-40,42,fill=1,stroke=0)
c.setFillColor(colors.white);c.roundRect(40,H-94,190,58,13,fill=1,stroke=0);c.drawImage(str(LOGO),53,H-82,164,39,preserveAspectRatio=True,mask='auto')
para('MANUAL VISUAL',42,H-134,460,12,colors.HexColor('#b9e7c8'),True)
para('O site da Conflora,\n<br/>passo a passo.',40,H-164,495,36,colors.white,True,43)
para('Uma tarefa por vez. A tela certa. O próximo passo claro.',42,H-270,460,13,colors.white)
image_fit(ASSETS/'caixa.png',40,H-318,W-80,300)
para('CAIXA  •  VENDEDOR  •  ENTREGADOR  •  ADMIN',42,173,500,10,colors.HexColor('#b9e7c8'),True)
para('Inclui orientações para ajudar o cliente a comprar e enviar o comprovante Pix.',42,148,480,11,colors.white)
para('Versão preparada em 18/10/2026. Use após a publicação da nova interface. As imagens têm dados demonstrativos; preços, clientes e chave Pix não são dados operacionais.',42,91,480,9,colors.HexColor('#d4e7d9'))
c.bookmarkPage('capa');c.addOutlineEntry('Capa','capa',0);c.showPage()
# Índice
header('ENCONTRE SUA FUNÇÃO','Comece pelo que você faz',2);c.bookmarkPage('indice');c.addOutlineEntry('Índice','indice',0)
y=H-170
sections=[('Toda a equipe','Entrada, navegação e regras básicas',0,1),('Caixa','Venda, cliente, pagamentos, Pix e comandas',2,11),('Vendedor','Montar e encaminhar a comanda',12,12),('Entregador','Assumir, sair e concluir a entrega',13,15),('Admin: produtos e estoque','Cadastro, importação, entrada e ajustes',16,19),('Admin: equipe e gestão','Aprovações, indicadores e fechamento',20,25),('Admin: suporte e loja','Erros e personalização',26,27),('Perfil e cliente','Conta, compra e comprovante',28,31)]
for title,desc,a,b in sections:
 c.setFillColor(colors.white);c.roundRect(40,y-57,W-80,52,10,fill=1,stroke=0)
 para(title,54,y-13,405,11,D,True);para(desc,54,y-30,405,9.5,M)
 c.setFillColor(G);c.setFont('CFBold',11);c.drawRightString(W-54,y-28,f'{a+4:02d} - {b+4:02d}')
 c.linkAbsolute(title,'p'+str(a),Rect=(40,y-57,W-40,y-5),thickness=0);y-=62
para('Clique no bloco para abrir a seção. No rodapé de cada página, Índice traz você de volta.',42,y-7,505,9,M)
for x,title,target in [(40,'Problemas e soluções  |  36','ajuda'),(303,'Checklist e atalhos  |  37','checklist')]:
 c.setFillColor(G);c.roundRect(x,91,252,29,9,fill=1,stroke=0);para(title,x+12,111,230,10,colors.white,True);c.linkAbsolute(title,target,Rect=(x,91,x+252,120),thickness=0)
footer(2);c.showPage()
# Mapa geral
header('ANTES DO PRIMEIRO ATENDIMENTO','Do pedido à conclusão',3);c.bookmarkPage('mapa');c.addOutlineEntry('Fluxo geral','mapa',0)
y=H-170
flow=[('1','MONTAR','Cliente ou Vendedor escolhe os produtos e informa retirada ou entrega.'),('2','CONFERIR','Caixa verifica os itens, o cliente, o valor e as aprovações necessárias.'),('3','RECEBER','Dinheiro/cartão são conferidos. Pix manual depende da conferência na conta bancária.'),('4','ENTREGAR','No balcão, liberar corretamente. Na entrega, assumir, separar, sair e concluir.'),('5','ACOMPANHAR','Admin confere pendências, compara recebimentos e registra o fechamento.')]
for n,title,body in flow:
 c.setFillColor(colors.white);c.roundRect(40,y-86,W-80,77,12,fill=1,stroke=0)
 y2=step(title,body,n,54,y-20,W-108);y-=98
note('Regra principal:','pedido criado, comprovante enviado e pagamento confirmado são situações diferentes. Confira o estado no site antes de liberar como pago.',40,y-5,W-80,'yellow')
footer(3);c.showPage()
# Fluxos ilustrados
for i,p in enumerate(PAGES):
 num=i+4;c.bookmarkPage('p'+str(i));c.addOutlineEntry(p['title'],'p'+str(i),0)
 y=header(p['group'],p['title'],num)
 y=para(escape(p['route']),40,y,515,10,G,True)-15
 im=ASSETS/(p['shot']+'.png');iw,ih=Image.open(im).size;portrait=iw/ih<1.12
 if portrait:
  imageTop=y;ix,iy,dw,dh=image_fit(im,40,imageTop,235,430)
  sy=y
  for n,(title,body) in enumerate(p['steps'],1):sy=step(title,body,n,293,sy,262)
  bottom=min(iy,sy)-14
  bottom=para(escape(p['caption']),40,bottom,515,7.8,M)-12
 else:
  ix,iy,dw,dh=image_fit(im,40,y,515,275)
  bottom=para(escape(p['caption']),40,iy-9,515,7.8,M)-13
  for n,(title,body) in enumerate(p['steps'],1):bottom=step(title,body,n,40,bottom,515)
 bottom=note('Pronto quando:',p['result'],40,bottom,515)
 if p['attention']:bottom=note('Atenção:',p['attention'],40,bottom,515,'yellow')
 if bottom<43:print('OVERFLOW',num,p['title'],round(bottom,1))
 footer(num);c.showPage()
# Resolução de problemas
num=len(PAGES)+4;header('CONSULTA RÁPIDA','Se algo der errado',num);c.bookmarkPage('ajuda');c.addOutlineEntry('Se algo der errado','ajuda',0)
y=H-170
for title,body in [('A tela travou depois de confirmar','Reconecte e procure o pedido nas Comandas ou no Histórico. Só repita após conferir que ele não foi registrado.'),('O cliente diz que pagou, mas o banco não mostra','Mantenha pendente. Peça ao Caixa/Admin para conferir a conta e o comprovante.'),('O comprovante está errado','Registre o motivo, recuse o comprovante e peça o arquivo correto. Não troque a forma de pagamento.'),('O WhatsApp não chegou','Consulte o estado no site. A ausência da mensagem não prova que a operação falhou.'),('Produto, preço ou estoque estão incorretos','Interrompa a conclusão e avise o responsável. Corrija o cadastro ou a movimentação apropriada.'),('A entrega não pôde ser feita','Não marque como entregue. Avise o Caixa/Admin para decidir o próximo passo.'),('Apareceu um erro inesperado','Anote horário, operação e mensagem. O Admin consulta Sistema e erros e encaminha ao suporte.')]:
 y=note(title+'.',body,40,y,515,'yellow' if 'pagou' in title else 'green')
footer(num);c.showPage()
# Cartão de bolso
num+=1;header('DEIXE PERTO DO CAIXA','Checklist do dia a dia',num);c.bookmarkPage('checklist');c.addOutlineEntry('Checklist e atalhos','checklist',0)
y=H-170
for title,body in [('ANTES DE ATENDER','Entrei na minha conta • Conferi meu nome e função • Sei quem chamar para aprovar uma exceção.'),('ANTES DE FINALIZAR','Cliente correto • Produtos corretos • UN/KG corretos • Total conferido • Forma de pagamento real.'),('NO PIX MANUAL','Comprovante aberto • Crédito confirmado no banco • Valor e beneficiário conferidos • Observação registrada.'),('ANTES DE LIBERAR UMA ENTREGA','Itens separados • Nome, telefone e endereço conferidos • Situação do pagamento entendida.'),('AO TERMINAR O TURNO','Pendências informadas • Valores entregues/conferidos • Sessão encerrada com Sair.')]:
 y=note(title,body,40,y,515)
y-=4;para('Atalhos do Caixa',40,y,515,16,D,True);y-=34
shortcuts=[('F1','Pagamento'),('F2','Comandas'),('F3','Relatório'),('F4','Desconto'),('F8','Entrega'),('F9','Histórico')]
for i,(key,label) in enumerate(shortcuts):
 x=40+(i%3)*175;top=y-(i//3)*54;c.setFillColor(colors.white);c.roundRect(x,top-43,165,43,9,fill=1,stroke=0);para(key,x+12,top-11,35,12,G,True);para(label,x+48,top-12,108,10,T)
para('No celular, use os botões da tela. Este guia descreve Pix manual. A ativação futura do Sicredi exige orientação atualizada da equipe.',40,y-128,515,10,M)
footer(num);c.showPage();c.save()
print('PDF',OUT,'PAGES',num)
(ASSETS/'page-map.json').write_text(json.dumps([{'page':i+4,**p} for i,p in enumerate(PAGES)],ensure_ascii=False,indent=2),encoding='utf-8')
