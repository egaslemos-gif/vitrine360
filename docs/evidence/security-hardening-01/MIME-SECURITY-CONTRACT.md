# MIME SECURITY CONTRACT

## Princípio de Segurança
O Mime Type declarado pelo utilizador (`client-declared MIME`) e a extensão do ficheiro são considerados `untrusted inputs`. 
Um asset de media só deve ser aceite se o seu conteúdo físico (assinatura/magic numbers) comprovar de forma irrefutável que se trata de um tipo de media suportado.

## Contrato de Validação

1. **Assinatura Conhecida e Suportada:** 
   Se o ficheiro apresentar uma assinatura válida de um tipo suportado, o tipo real detetado (`detected MIME`) sobrepõe-se ao Mime Type declarado pelo utilizador, validando o asset e persistindo o tipo real detetado.
2. **Assinatura Desconhecida / Não Multimédia:**
   Se o ficheiro não contiver uma assinatura de formato de imagem, vídeo ou áudio (ou seja, retornar `null` no `sniffMime`), o asset **DEVE SER IMEDIATAMENTE REJEITADO**, ignorando completamente qualquer fallback fornecido pelo utilizador (e.g. rejeitando executáveis disfarçados com a extensão `.png`).
3. **MIME Declarado Inválido / Assinatura Válida:**
   Se o MIME declarado for irrelevante mas a assinatura for de um media suportado, o media suportado prevalece. (Normalização).
4. **Ficheiros Vazios/Truncados:**
   Ficheiros que não atinjam o comprimento mínimo para verificação de assinaturas não podem ser positivamente validados e serão consequentemente rejeitados.

## Resolução Implementacional
- Alterar `sniffMime` em `src/services/media/paths.ts` para retornar `string | null` e remover totalmente o conceito de argumento genérico de `fallback`.
- Em `uploadMediaAsset`, remover a cadeia lógica `|| params.mimeType`. O upload só prossegue se `sniffMime` retornar um valor e esse valor pertencer estritamente a `ALLOWED_MIME`.
