export function getWowheadNpcUrl(npcId: number) {
  return `https://www.wowhead.com/npc=${npcId}`
}

export function getWowheadSpellUrl(spellId: number) {
  return `https://www.wowhead.com/spell=${spellId}`
}

export function getWowheadNpcEmbedUrl(npcId: number) {
  return getWowheadNpcUrl(npcId)
}
