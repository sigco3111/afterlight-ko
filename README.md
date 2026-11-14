# Afterlight — 한국어판 (비공식)

*세상이 끝난 날, 나는 열여섯이 되었다. 이 이야기는 그 뒤에 우리가 세운 것에 대한 것이다.*

three.js로 만든 2D-HD JRPG **Afterlight**의 비공식 한국어판입니다.

- 배포: <https://sigco3111.github.io/afterlight-ko/>
- 원작: <https://github.com/FriendlyUser/afterlight> (FriendlyUser)
- 한국어판 저장소: <https://github.com/sigco3111/afterlight-ko>

## 원작 소개

픽셀 아트 캐릭터를 조명과 심도 표현이 들어간 디오라마에 올려 놓은 2D-HD JRPG입니다.
열여섯 살에 세상의 끝을 불러온 소녀가 그럼에도 자라나는 이야기로, 본편 12장과 포스트게임,
24개 클래스(크레스트)와 10랭크, 전투 중 가드/브레이크, 낚시, 도감, 저장 6슬롯+자동 저장 등을 갖추고 있습니다.

## 한글화 방식

원작 소스를 가능한 한 그대로 두고 **오버레이 방식**으로 번역했습니다.

- `i18n/parts/*.json` : 영어 원문 → 한국어 사전(키 = 원문 문자열). 빌드 전 `tools/merge-ko.mjs`가 `src/i18n/ko.json`으로 합칩니다.
- `src/i18n/index.js` : `t()` 조회, 언어 결정(`?lang=ko|en`, `localStorage.afterlight.lang`, 기본 한국어).
- `src/i18n/dom.js` : 화면에 그려진 텍스트 노드를 사전으로 치환하는 감시자 + 우하단 **EN/한글** 토글 버튼.
- `src/i18n/data.js` : 아이템·장비·스킬·적·크레스트·상태·튜토리얼의 표시 문자열을 로드 후 치환(id는 그대로라 게임 로직 영향 없음).
- 대사는 `ScriptContext.fill()`과 `UI.dialogue()` 한 곳에서 번역되므로, 사전에 없는 문장은 **영어 그대로** 표시되고 게임은 깨지지 않습니다.

### 언어 바꾸기

- 화면 오른쪽 아래 **EN / 한글** 버튼, 또는
- 주소에 `?lang=en` / `?lang=ko` 를 붙이거나, 브라우저 콘솔에서 `localStorage.setItem('afterlight.lang','en')` 후 새로고침.

### 폰트

한글은 시스템 폰트(맑은 고딕, Apple SD Gothic Neo, Noto Sans KR, 나눔고딕)를 우선 사용합니다(`css/ko.css`).
추가 웹폰트를 내려받지 않습니다. 영어로 전환하면 원작의 Alegreya/Cinzel이 그대로 쓰입니다.

## 번역 범위 (2026-11 기준)

| 영역 | 상태 |
|---|---|
| 타이틀·설정·메인 메뉴·아이템/상태 화면 등 UI | 대부분 번역 |
| 아이템 이름·설명, 상태 이상, 기본 크레스트 이름 | 번역 |
| 1장(프롤로그) 대사·목표·일지 | 번역 |
| 2장 이후 대사, 스킬 이름/설명, 적 이름/설명, 맵 이름, 전투 로그 | **미번역(영어)** |

미번역 구간은 영어로 표시됩니다. 번역 추가는 `i18n/parts/`에 JSON을 더하고 다시 배포하면 됩니다.

## 번역 외 변경

- `src/main.js`, `src/ui/UI.js`, `src/script/ScriptContext.js`에 i18n 훅 3곳 추가(위 설명).
- `index.html`에 `css/ko.css` 링크 추가, `tools/patch-i18n.mjs`로 재현 가능.
- 외부 서버·통계·의견 수집 기능은 원작에 없어 제거할 것이 없었습니다(소스에 분석/텔레메트리 호출 없음).
- 게임 플레이는 모두 브라우저 안에서 실행되며 저장 데이터는 localStorage에만 남습니다.

## 빌드 · 배포

```bash
node tools/merge-ko.mjs      # i18n/parts/*.json -> src/i18n/ko.json
npm install
npx vite build --base=./     # dist/
```

저장소의 `.github/workflows/ko-build.yml`이 main 푸시/수동 실행 시 위 과정을 거쳐 GitHub Pages로 배포합니다.
자산 경로는 모두 상대 경로(`base: './'`)이며, 빌드 단계에서 루트 절대경로(`/...`) 참조가 0건인지 확인합니다.

## 크레딧

- 원작 및 모든 게임 콘텐츠: **FriendlyUser** — <https://github.com/FriendlyUser/afterlight>
- 엔진: three.js (MIT), 폰트: Alegreya / Alegreya Sans SC / Cinzel (SIL Open Font License 1.1)
- 한국어 번역·오버레이: sigco3111

원작 README(영문)는 `README.en.md`에 그대로 보존했습니다.

## 라이선스 상태 (중요)

원작 저장소에는 **라이선스 파일이 없습니다**. 포함된 제3자 구성 요소는 three.js(MIT)와 폰트(OFL)뿐이며,
그 라이선스 텍스트는 원작과 동일하게 `fonts/OFL-*.txt`, `vendor/three/`에 있습니다.

원작자의 명시적 허락 없이 공개된 비공식 번역판입니다. **원작자(FriendlyUser)가 삭제를 요청하면 이 저장소와 배포 페이지를 즉시 내립니다.**
문제가 있다면 저장소 이슈로 알려 주세요.
