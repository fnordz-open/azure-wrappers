azure-wrappers
==============

scripts to improve the node.js azure apis (specially for mobile-client)


***query-builder***

auxilia a montar e invocar queries que não seguem o padrão restful do azure como:
- query insert sem id (por exemplo, tabelas de relacionamento)
- query deletes com where
- execução de stored procedures


***push-notificator***

abstrai como cada plataforma manipula as mensagens e dados para enviar uma mensagem push.
pode ser usado o esquema de tags, porém se nenhuma for setada, a mensagem será enviada
para todos os dispositivos registrados no hub


***dumper***

fornece a função varDump que permite uma configuração refinada de dump de um objeto js,
muito superior a fornecida pelo console.log do azure.