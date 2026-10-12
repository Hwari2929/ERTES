// 사건 연출 모음: 사건 id → 연출. 연출이 없는 사건은 기존 text 를 서술 한 줄로 보여 준다.
import { BGMS, BGS, NPCS, SFXS, type EventScene, type SceneReg } from '../scene';
import { COMMON_REG, COMMON_SCENES } from './common';
import { PILOT_SCENES } from './pilot';
import { STORY_A_REG, STORY_A_SCENES } from './story_a';
import { STORY_B_REG, STORY_B_SCENES } from './story_b';
import { STORY_C_REG, STORY_C_SCENES } from './story_c';
import { STORY_D_REG, STORY_D_SCENES } from './story_d';

// 묶음별 등록부(NPC · 배경 · 배경음 · 효과음)를 공용 등록부에 합친다
for (const r of [COMMON_REG, STORY_A_REG, STORY_B_REG, STORY_C_REG, STORY_D_REG] as SceneReg[]) {
  Object.assign(NPCS, r.npcs || {});
  Object.assign(BGS, r.bgs || {});
  Object.assign(BGMS, r.bgms || {});
  Object.assign(SFXS, r.sfxs || {});
}

export const EVENT_SCENES: Record<string, EventScene> = {
  ...PILOT_SCENES, ...COMMON_SCENES, ...STORY_A_SCENES, ...STORY_B_SCENES, ...STORY_C_SCENES, ...STORY_D_SCENES,
};
