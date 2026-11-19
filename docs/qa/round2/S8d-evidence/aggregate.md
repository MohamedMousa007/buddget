| metric | small runs | small median | large runs | large median |
|---|---|---|---|---|
| cold_signedout_form_ready_ms | 3918 / 3740 / 3675 | **3740** | 3752 / 4087 / 3772 | **3772** |
| cold_signedout_fcp_ms | 3476 / 3436 / 3308 | **3436** | 3384 / 3640 / 3468 | **3468** |
| cold_signedout_lcp_ms | 3476 / 3436 / 3308 | **3436** | 3384 / 3640 / 3468 | **3468** |
| signin_to_shell_ms | 12376 / 11973 / 7558 | **11973** | 6491 / 6207 / 5819 | **6207** |
| signin_to_synced_ms | 12416 / 12001 / 7595 | **12001** | 6690 / 6371 / 6081 | **6371** |
| signin_to_settled_ms | 13407 / 12801 / 7622 | **12801** | 7944 / 7498 / 6845 | **7498** |
| signin_longtask_ms | 825 / 656 / 862 | **825** | 2751 / 2990 / 2560 | **2751** |
| reload_to_shell_ms | 2659 / 2555 / 2516 | **2555** | 4006 / 4274 / 4326 | **4274** |
| reload_fcp_ms | 2300 / 2212 / 2144 | **2212** | 2916 / 3276 / 2992 | **2992** |
| reload_lcp_ms | 2300 / 2212 / 2144 | **2212** | 2916 / 3276 / 2992 | **2992** |
| tab_accounts_ms | 320 / 234 / 247 | **247** | 448 / 908 / 454 | **454** |
| tab_accounts_longtask_ms | 0 / 0 / 0 | **0** | 0 / 0 / 0 | **0** |
| tab_wealth_ms | 406 / 274 / 387 | **387** | 426 / 360 / 283 | **360** |
| tab_wealth_longtask_ms | 0 / 0 / 0 | **0** | 60 / 0 / 0 | **0** |
| tab_debts_ms | 229 / 188 / 265 | **229** | 260 / 773 / 667 | **667** |
| tab_debts_longtask_ms | 0 / 0 / 0 | **0** | 0 / 0 / 0 | **0** |
| tab_flow_ms | 411 / 1846 / 689 | **689** | 1899 / 1189 / 1413 | **1413** |
| tab_flow_longtask_ms | 0 / 0 / 376 | **0** | 310 / 194 / 262 | **262** |
| reports_ms | 2929 / 2964 / 2972 | **2964** | 2905 / 3424 / 3213 | **3213** |
| reports_longtask_ms | 679 / 668 / 702 | **679** | 565 / 917 / 828 | **828** |
| wealth_ms | 617 / 402 / 739 | **617** | 1738 / 253 / 320 | **320** |
| wealth_longtask_ms | 0 / 0 / 0 | **0** | 0 / 0 / 0 | **0** |
| back_to_flow_ms | 384 / 540 / 411 | **411** | 1520 / 1312 / 1323 | **1323** |
| back_to_flow_longtask_ms | 0 / 0 / 0 | **0** | 184 / 121 / 200 | **184** |
| open_add_sheet_ms | 586 / 1417 / 1407 | **1407** | 1634 / 1416 / 1757 | **1634** |
| open_add_sheet_longtask_ms | 0 / 0 / 0 | **0** | 0 / 0 / 0 | **0** |
| save_expense_sheet_closed_ms | 604 / 773 / 564 | **604** | 978 / 1086 / 1014 | **1014** |
| save_expense_longtask_ms | 0 / 0 / 0 | **0** | 0 / 136 / 0 | **0** |
| save_expense_row_visible_after_ms | 33 / 37 / 24 | **33** | 75 / 74 / 91 | **75** |

### requests per step (median, data = REST/RPC/auth/api; sentry envelopes counted apart)
| step | user | data requests | of which Sentry envelope | static requests | duplicate data requests |
|---|---|---|---|---|---|
| cold_load_signed_out | small | 0 | 1 | 72 | 0 |
| signin_to_flow | small | 20 | 3 | 13 | 0 |
| reload_signed_in | small | 20 | 3 | 82 | 1 |
| tab_accounts | small | 1 | 2 | 0 | 0 |
| tab_wealth | small | 0 | 2 | 0 | 0 |
| tab_debts | small | 0 | 2 | 0 | 0 |
| tab_flow | small | 1 | 2 | 0 | 0 |
| reports | small | 0 | 2 | 5 | 0 |
| wealth | small | 0 | 2 | 0 | 0 |
| back_to_flow | small | 1 | 2 | 0 | 0 |
| save_expense | small | 1 | 0 | 0 | 0 |
| cold_load_signed_out | large | 0 | 1 | 72 | 0 |
| signin_to_flow | large | 20 | 3 | 13 | 0 |
| reload_signed_in | large | 22 | 3 | 82 | 1 |
| tab_accounts | large | 1 | 2 | 0 | 0 |
| tab_wealth | large | 0 | 2 | 0 | 0 |
| tab_debts | large | 0 | 2 | 0 | 0 |
| tab_flow | large | 1 | 2 | 0 | 0 |
| reports | large | 0 | 2 | 5 | 0 |
| wealth | large | 0 | 2 | 0 | 0 |
| back_to_flow | large | 1 | 2 | 0 | 0 |
| save_expense | large | 1 | 0 | 0 | 0 |
