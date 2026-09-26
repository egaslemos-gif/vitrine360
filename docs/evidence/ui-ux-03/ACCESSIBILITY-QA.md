# ACCESSIBILITY-QA

| Control | Evidence |
|---------|----------|
| ViewSwitcher | `aria-pressed`, `aria-label` Grid/List |
| ListView | `role="table"` |
| ListRow | `role="row"`, `aria-selected` when selected |
| Checkboxes | Named `aria-label` |
| Seek/focus | Focus-visible rings on links/buttons |
| Media type tabs | `role="tab"` + `aria-selected` |
| Device actions | Existing DeviceActions labels |

Keyboard: rows with `onClick` support Enter/Space; primary actions remain native buttons/links.
