# PLAYER-ORPHAN-ITEM-01 REPORT

[PLAYER-ORPHAN-ITEM-01 — ROOT CAUSE IDENTIFIED]

## Sumário Executivo
Após um tracking exaustivo desde o código-fonte até à base de dados de produção, foi categoricamente descartada a hipótese de tratar-se de um bug de cache (Manifestos *stale*), vazamento de testes (*fixture leaks*) ou ficheiros fantasma (órfãos de playlist). A origem do sintoma "Editor smoke text" recai inteiramente em definições perfeitamente válidas no servidor, embora ofuscadas/não esperadas para o utilizador no Admin.

A causa classificada é **DEVICE_DEFAULT_PLAYLIST**.

## Cronologia Investigativa
1. **Source Code**: A pesquisa demonstrou que o texto não consta em hardcode.
2. **Database Trace**: A base de dados revelou que o Content e a sua associação a uma Playlist efetivamente **Existem**. A Playlist é designada `"Playlist Padrão"` (ID `a7d095b8...`).
3. **Schedules**: `0` schedules apontam para a Playlist.
4. **Devices**: Os dados de telemetria apontam que o dispositivo a reproduzir o `smoke text` tem a `Playlist Padrão` configurada como o seu fallback (`currentPlaylistId`). Como não havia *Schedule* a sobrepor, foi este manifesto de fallback entregue pelo servidor ao cliente (e reportado como ManifestVersion=7).

## Parecer Técnico
A confusão com "nenhuma Playlist conhecida contendo esse Content" provém do desconhecimento/invisibilidade administrativa da existência e conteúdo atual da "Playlist Padrão" que, em caso de vácuo de agendamentos, o dispositivo passivamente descarrega e executa com sucesso.

Toda a documentação granular encontra-se nesta diretoria. O sistema operou de forma fiel aos seus dados; o que requer intervenção é apenas a gestão da referida playlist no Admin UI.

*(Nenhuma cache, DB, ou código foram modificados durante esta auditoria)*
