# Traverser — Canonical Data Manifest

The single ID registry shared by all three phase projects (dev, art, audio). Every content entity gets exactly one snake_case key, used for: database seed data, code enums/constants, sprite filenames (`{key}.png`), and audio filenames (Section 14's `mus_`/`stg_`/`sfx_` IDs). Display names live here too so UI strings, art labels, and lore text never diverge. **This file defines IDs and names only — all stats, formulas, and behavior stay in the GDD (single source of truth), with verified values in `traverser-test-fixtures.md`.**

## Types (6)
`storm`, `war`, `trickery`, `underworld`, `sea`, `wisdom` — cycle order is significant (Section 2). Secondary effects: `weaken`, `fortify`, `swift`, `rend`. Tiers/rarities: `mortal|heroic|mythic|divine` (gear), `common|uncommon|rare` (items). Zones: `olympion`, `valheon`, `imperion` (+ reserved `egypt_tbd`, Phase 2).

## Enemies (12 canon + 1 tutorial-only)
| Key | Display Name | Zone | Type | Role |
|---|---|---|---|---|
| `enemy_harpy` | Harpy | olympion | storm | wild |
| `enemy_satyr` | Satyr | olympion | trickery | wild |
| `enemy_cyclops` | Cyclops | olympion | war | mid-boss |
| `enemy_cerberus` | Cerberus | olympion | underworld | zone boss |
| `enemy_draugr` | Draugr | valheon | underworld | wild |
| `enemy_valkyrie` | Valkyrie | valheon | storm | wild |
| `enemy_fenrir` | Fenrir | valheon | war | mid-boss |
| `enemy_jormungandr` | Jörmungandr | valheon | sea | zone boss |
| `enemy_strix` | Strix | imperion | trickery | wild |
| `enemy_lemures` | Lemures | imperion | underworld | wild |
| `enemy_griffin` | Griffin | imperion | wisdom | mid-boss |
| `enemy_cacus` | Cacus | imperion | storm | zone boss |
| `enemy_waystone_wisp` | Waystone Wisp | — (tutorial only) | none | scripted tutorial |

## Player Skills — level-unlocked (Section 3)
| Key | Display Name | Type | Power | Uses | Unlock |
|---|---|---|---|---|---|
| `skill_iron_advance` | Iron Advance | physical | 60 | 5 | L4 |
| `skill_thunderers_wrath` | Thunderer's Wrath | storm | 65 | 4 | L6 |
| `skill_warlords_advance` | Warlord's Advance | war | 65 | 4 | L10 |
| `skill_shadowstep` | Shadowstep | trickery | 55 | 5 | L16 |
| `skill_titans_reach` | Titan's Reach | physical | 80 | 4 | L22 |
| `skill_pale_sentence` | Pale Sentence | underworld | 75 | 3 | L30 |
| `skill_tidecallers_grasp` | Tidecaller's Grasp | sea | 65 | 4 | L36 |
| `skill_sages_verdict` | Sage's Verdict | wisdom | 75 | 3 | L44 |
| `skill_champions_surge` | Champion's Surge | physical | 100 | 3 | L56 |

Plus `skill_basic_attack` — Basic Attack, physical, P40, unlimited, always available.

## Gear-Granted Moves — Trinket only (Section 8 §4.2)
| Key | Display Name | Source Trinket | Type | Power | Uses | Effect |
|---|---|---|---|---|---|---|
| `move_gatekeepers_ruse` | Gatekeeper's Ruse | gear_gatekeepers_ruse | trickery | 80 | 4 | — |
| `move_gatekeepers_snare` | Gatekeeper's Snare | gear_gatekeepers_snare | trickery | 75 | 3 | rend |
| `move_coilbreakers_oath` | Coilbreaker's Oath | gear_coilbreakers_oath | war | 80 | 4 | — |
| `move_coilbreakers_wrath` | Coilbreaker's Wrath | gear_coilbreakers_wrath | war | 75 | 3 | weaken |
| `move_emberwise_ward` | Emberwise Ward | gear_emberwise_ward | wisdom | 80 | 4 | — |
| `move_emberwise_verdict` | Emberwise Verdict | gear_emberwise_verdict | wisdom | 75 | 3 | fortify |

## Enemy Moves (Sections 5–7, 10)
Category `divine` = Favor vs. Aegis; `physical` = Might vs. Resolve. AI weights per enemy sum to 100.
| Key | Display Name | Owner | Category/Type | Power | AI Weight |
|---|---|---|---|---|---|
| `emove_gust_strike` | Gust Strike | enemy_harpy | divine/storm | 40 | 70% |
| `emove_buffet` | Buffet | enemy_harpy | physical | 25 | 30% |
| `emove_shadow_lunge` | Shadow Lunge | enemy_satyr | divine/trickery | 45 | 60% |
| `emove_quick_jab` | Quick Jab | enemy_satyr | physical | 30 | 40% |
| `emove_boulder_hurl` | Boulder Hurl | enemy_cyclops | physical | 40 | 60% |
| `emove_war_shout` | War Shout | enemy_cyclops | divine/war | 55 | 40% |
| `emove_death_breath` | Death Breath | enemy_cerberus | divine/underworld | 60 | 45% |
| `emove_three_fanged_strike` | Three-Fanged Strike | enemy_cerberus | physical | 50 | 35% |
| `emove_savage_bite_cerberus` | Savage Bite | enemy_cerberus | physical | 40 | 20% |
| `emove_grave_swing` | Grave Swing | enemy_draugr | physical | 50 | 60% |
| `emove_soul_drain` | Soul Drain | enemy_draugr | divine/underworld | 40 | 40% |
| `emove_storm_lance` | Storm Lance | enemy_valkyrie | divine/storm | 50 | 80% |
| `emove_shield_bash` | Shield Bash | enemy_valkyrie | physical | 20 | 20% |
| `emove_savage_bite_fenrir` | Savage Bite | enemy_fenrir | physical | 40 | 50% |
| `emove_war_howl` | War Howl | enemy_fenrir | divine/war | 50 | 50% |
| `emove_crushing_coil` | Crushing Coil | enemy_jormungandr | physical | 55 | 30% |
| `emove_venom_tide` | Venom Tide | enemy_jormungandr | divine/sea | 65 | 45% |
| `emove_world_tremor` | World Tremor | enemy_jormungandr | physical | 40 | 25% |
| `emove_nightcut` | Nightcut | enemy_strix | divine/trickery | 45 | 60% |
| `emove_talon_rake` | Talon Rake | enemy_strix | physical | 30 | 40% |
| `emove_restless_grasp` | Restless Grasp | enemy_lemures | physical | 50 | 60% |
| `emove_grave_knell` | Grave Knell | enemy_lemures | divine/underworld | 40 | 40% |
| `emove_wing_buffet` | Wing Buffet | enemy_griffin | physical | 50 | 50% |
| `emove_vigilant_gaze` | Vigilant Gaze | enemy_griffin | divine/wisdom | 55 | 50% |
| `emove_thunderous_roar` | Thunderous Roar | enemy_cacus | divine/storm | 70 | 40% |
| `emove_cinder_grip` | Cinder Grip | enemy_cacus | physical | 60 | 35% |
| `emove_ashen_gale` | Ashen Gale | enemy_cacus | divine/storm | 45 | 25% |
| `emove_chilling_gust` | Chilling Gust | enemy_waystone_wisp | divine/none | 30 | scripted |

Note: "Savage Bite" appears on both Cerberus and Fenrir with different AI weights — hence per-owner keys. Sprite/SFX work can share assets across the two if desired; the IDs stay distinct.

## Battle Items (Section 4, 18 total)
| Key | Display Name | Category | Rarity | Max |
|---|---|---|---|---|
| `item_travelers_salve` | Traveler's Salve | heal 20% | common | 5 |
| `item_heralds_draft` | Herald's Draft | heal 40% | uncommon | 3 |
| `item_ambrosia_shard` | Ambrosia Shard | heal 100% | rare | 2 |
| `item_ironhide_tincture` | Ironhide Tincture | buff (fortify) | uncommon | 3 |
| `item_sunder_oil` | Sunder Oil | buff (weaken) | uncommon | 3 |
| `item_fleet_omen` | Fleet Omen | buff (swift) | rare | 2 |
| `item_stormveil` | Stormveil | surge/storm | common | 3 |
| `item_battlebrand` | Battlebrand | surge/war | common | 3 |
| `item_shadowblur` | Shadowblur | surge/trickery | common | 3 |
| `item_pale_ash` | Pale Ash | surge/underworld | common | 3 |
| `item_brinestone` | Brinestone | surge/sea | common | 3 |
| `item_clearsight` | Clearsight | surge/wisdom | common | 3 |
| `item_thundercrack` | Thundercrack | breach/storm | uncommon | 3 |
| `item_warhex` | Warhex | breach/war | uncommon | 3 |
| `item_shadowbind` | Shadowbind | breach/trickery | uncommon | 3 |
| `item_gravemark` | Gravemark | breach/underworld | uncommon | 3 |
| `item_undertow` | Undertow | breach/sea | uncommon | 3 |
| `item_blindveil` | Blindveil | breach/wisdom | uncommon | 3 |

## Gear (Section 8)
Weapon/Armor/Accessory — one tier ladder, zone-agnostic, one silhouette per slot:
| Key pattern | Mortal | Heroic | Mythic | Divine |
|---|---|---|---|---|
| `gear_weapon_{tier}` | Traveler's Blade | Warden's Blade | Paragon's Blade | Ascendant's Blade |
| `gear_armor_{tier}` | Traveler's Guard | Warden's Guard | Paragon's Guard | Ascendant's Guard |
| `gear_accessory_{tier}` | Traveler's Band | Warden's Band | Paragon's Band | Ascendant's Band |

Trinkets (zone-specific, the only bespoke per-item art in the game):
`gear_skyroad_sigil` (Skyroad Sigil, heroic, Cyclops) · `gear_frostroad_sigil` (Frostroad Sigil, heroic, Fenrir) · `gear_sunroad_sigil` (Sunroad Sigil, heroic, Griffin) · `gear_gatekeepers_ruse` (mythic, Cerberus repeat) · `gear_gatekeepers_snare` (divine, Cerberus first kill) · `gear_coilbreakers_oath` (mythic, Jörmungandr repeat) · `gear_coilbreakers_wrath` (divine, Jörmungandr first kill) · `gear_emberwise_ward` (mythic, Cacus repeat) · `gear_emberwise_verdict` (divine, Cacus first kill). Heroic Sigils grant **no move**.

## Audio IDs (Section 14 — already canonical, listed for completeness)
Music: `mus_title`, `mus_oldroads`, `mus_hub`, `mus_map_mvp`, `mus_map_olympion`, `mus_map_valheon`, `mus_map_imperion`, `mus_battle_tutorial`, `mus_battle_olympion`, `mus_battle_valheon`, `mus_battle_imperion`, `mus_boss_cyclops`, `mus_boss_cerberus`, `mus_boss_fenrir`, `mus_boss_jormungandr`, `mus_boss_griffin`, `mus_boss_cacus`, `mus_entry_valheon`, `mus_entry_imperion`.
Stingers: `stg_victory`, `stg_victory_boss`, `stg_defeat`, `stg_boss_intro`, `stg_type_super`, `stg_type_resisted`, `stg_reveal_*`, `stg_waymarker`, `stg_rest_day`, `stg_streak_break`, `stg_overactivity`, `stg_egypt_tease`.
SFX: `sfx_button_tap`, `sfx_button_disabled`, `sfx_tab_switch`, `sfx_subtab_switch`, `sfx_screen_push`, `sfx_screen_pop`, `sfx_modal_open`, `sfx_menu_select_action`, `sfx_encounter_start`, `sfx_hit_physical`, `sfx_hit_storm`, `sfx_hit_war`, `sfx_hit_trickery`, `sfx_hit_underworld`, `sfx_hit_sea`, `sfx_hit_wisdom`, `sfx_crit`, `sfx_enemy_faint`, `sfx_item_heal`, `sfx_item_buff`, `sfx_item_charm`, `sfx_skill_locked`, `sfx_flee_success`, `sfx_flee_denied`, `sfx_dialogue_advance`, `sfx_footstep_loop`, `sfx_banner_appear`, `sfx_reveal_card_flip`, `sfx_toggle`, `sfx_volume`.

## Analytics Event Names (Sections 11 §9 / 12 / 15 — deferred, reserved)
`streak_day_completed`, `streak_broken`, `rest_day_tagged`, `auto_sync_grace_used`, `streak_milestone_reached`, `notification_sent`, `notification_opened`, `overactivity_warning_shown`, `signin_prompt_resurfaced`, `lore_screen_viewed`, `bestiary_entry_viewed`, plus Section 15's full schema. Not implemented in the fun-first scope — reserved here so nothing else claims these names.

## Rules
1. New content = new key added here first, then used everywhere.
2. Keys never change once shipped in a save file; display names can.
3. Art exports: `{key}.png` at final size. Audio exports: `{key}.ogg` (or format chosen in the audio project).
4. On any conflict between this manifest and a GDD section's spelling, the GDD wins — fix the manifest and flag it.
