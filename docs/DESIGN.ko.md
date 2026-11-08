# LemmaDuck 구성 최종안

**저장소** `ts06068/LemmaDuck`　·　**명령 이름** `duck` (`lemmaduck` 호환)　·　**설계 기준일** 2026-11-01

연구자가 Paseo에서 질문을 열면, 에이전트가 업무 요청과 문헌을 찾아 경쟁 가설을 세우고 실험을 실행한다. 연구자는 가설의 채택·기각 근거를 보고, 같은 결과에서 재생성한 표·그림·원고와 자기 문체의 답신을 검토한다. **Lemma**는 다음 주장을 지탱하는 작은 결과, **Duck**은 개발자가 문제를 설명하며 생각을 다듬는 러버덕을 뜻한다.

이 문서는 새 저장소에 들어갈 제품·구현·검수 명세다. 기계 판독 목록은 `catalog/full.json`, pstack·gstack의 원본 목록은 `locks/`에 있다. 함께 제공한 `tools/workflow_sources.py`는 두 원본을 내려받고 검증하는 도구다. 현재 구현된 설치·연결·라우팅은 README와 개별 운영 가이드를 따른다. 이 문서의 나머지 항목에는 후속 구현·기관별 연결 계획도 포함된다.

## 1. 한 번 설치해서 무엇을 여는가

| 작업 위치 | 기본 작업대 | 작업이 실제로 실행되는 위치 |
| --- | --- | --- |
| Windows 11 x64 PC | Paseo Desktop. Warp는 선택 터미널이다 | WSL2 Ubuntu x64 또는 원격 Linux. 장시간 세션은 서버에 유지한다 |
| Surface Pro 11 ARM64 | Paseo Desktop ARM64 | SSH로 동일 호스트에 접속한다. ARM에서 Linux x64 전용 패키지를 실행할 필요가 없다 |
| Galaxy Tab S11 Ultra | Paseo Android | 같은 Linux 호스트에 연결한다. 개발은 LemmaDuck Code, 연구·업무는 터미널의 Pi 세션을 연다 |
| Ubuntu 서버·클라우드 GPU | Paseo 데몬과 원격 클라이언트, 선택 Warp SSH | 서버에서 모델 워커·실험·CI 작업을 실행한다. 끊긴 화면을 다시 열 수 있다 |
| 폐쇄망 Windows Server 2022 | 기관 승인 로컬 UI·작업 큐 | 네이티브 R/Python/SQL과 승인된 로컬 모델. 컨테이너 없는 설치·복원 경로를 둔다 |
| 기존 편집 환경 | VS Code 폴더·프로젝트·diff 관리 | 원하는 경우 Webview로 해당 작업을 연다. Zellij·Neovim/LazyVim과 macOS의 cmux도 선택 경로로 제공한다 |

Paseo가 호스트·작업공간·에이전트 대화·터미널 연결을 맡는다. 개발은 네이티브 OMP 프로바이더인 **LemmaDuck Code**로 연다. 연구·원고·비서는 터미널에서 Pi를 실행한다. 같은 호스트·계정·프로젝트에서 세션을 재개한다. Herdr와 Warp는 선택 작업대다. [Paseo](https://paseo.sh/) · [연결 가이드](https://paseo.sh/docs/connectivity)

**원클릭 계약**. 새 릴리스는 Windows용 실행 런처와 Linux용 부트스트랩을 제공한다. GUI의 **전체 환경 설정**과 CLI의 `duck setup --full`이 같은 설치 계획을 쓴다. OS·CPU·망을 감지하고, 릴리스와 체크섬을 확인하고, 실행 호스트·UI·모듈 전체를 등록하고, 계정별 로그인 화면으로 연결한 뒤 `doctor` 보고서를 연다. 개인 OAuth 로그인·조직 동의·폐쇄망 반입은 해당 계정과 기관의 절차를 따른다. 두 번째 실행은 이미 맞는 항목을 건너뛴다. 중단 후 재개, dry run, 버전 지정 복원, 처음 연결하는 계정의 범위 선택까지 설치 계약에 포함한다.

`doctor`는 기능마다 **사용 가능 / 로그인 필요 / 조직 허용 필요 / 이 호스트에서 사용할 수 없음 / 점검 실패**와 다음 조치를 표시한다. 모든 모듈은 full 카탈로그에 있어야 한다. 실제 호출할 모델, 접근할 계정, 시작할 워커 수는 그 작업의 프로필이 정한다.

## 2. 실행 코어·상태·권한

| 구성 | 결정 및 동작 |
| --- | --- |
| 하네스 | 개발은 **OMP 18.14.2**, 연구·원고·비서는 **Pi 0.87.1 SDK/확장/RPC**를 쓴다. OMP 개발 세션과 Pi 태스크 저널은 독립적이다. 공식 Codex·Claude Code 세션, Cursor 및 Warp 자체 agent는 기능과 인증 조건을 표시하는 호스트 어댑터로 둔다 |
| 모델과 비용 | 기존 ChatGPT/Codex 구독 로그인, Claude 구독의 허용된 Agent SDK 브리지, Google Antigravity ACP를 이어받는다. `/ask`는 작업 유형과 로그인 상태에 따라 구성된 공급자·모델·추론 수준을 선택한다. `/route`와 `/switch`로 사용자가 지정할 수 있다. Gemini의 세부 추론 수준은 현재 공급자 관리로 기록한다. 한도에 도달하면 체크포인트에서 멈춘다. 직접 등록한 API·Ollama·vLLM은 독립 경로다. 공급자가 보고하지 않은 사용량은 `null`이다 |
| 프로토콜 | Paseo의 네이티브 OMP 프로바이더는 `rpc-ui`, Pi 터미널 및 테스트는 Pi RPC를 쓴다. ACP는 클라이언트↔지원 에이전트, MCP는 에이전트↔도구·자료의 경계다. 호스트별 스트리밍, 취소, 복구, 미터링, 파일 편집, 서브에이전트 가능 여부를 협상한다 |
| 태스크 | `/task new`, `/task link`, `/ask`, `/route`, `/switch`, `/handoff`, `/review`, `/usage`와 작업·검토 모드를 보존한다. 사용자가 모델을 바꿔도 승인된 입력, 결정, 미해결 질문, 산출물, 검증 결과를 인계한다 |
| 문맥·기억 | 프로젝트 지침, 계정 범위, 승인 자료, 현재 가설, 열린 일을 따로 관리한다. 검색은 메타데이터·키워드/FTS와 권한을 상속한 임베딩/RAG를 결합한다. 스킬은 필요할 때 본문을 펼치고 요약에서 출처·페이지·버전으로 돌아갈 수 있게 한다 |
| 상태·관찰 | 작업별 이벤트 저널과 재구축 가능한 SQLite 인덱스를 둔다. 실행·시도·부모 실행 ID, 선택 모델, 입력 해시, 도구 결과·종료 코드, 산출물, 판단, 사용량을 기록한다. 플랫폼이 노출하는 사건만 수집한다. 기본 운영은 로컬 최소 계측이다 |
| 병렬 작업 | 조정자, 실행자, 독립 검토자를 작업 필요에 따라 배정한다. 변경 단위마다 worktree와 책임자를 하나 정한다. budget·기한·동시성·중단 조건을 선언하고, 합류 시 결과와 충돌을 확인한다. 리뷰 세션은 읽기 전용이다 |
| 부작용과 복구 | 읽기·초안·내부 변경·외부 발송/공개·삭제를 구분한다. 효과를 일으키기 전에 계정·대상·범위와 사용자가 준 권한을 확인한다. 동작 키와 서비스 영수증을 저장한다. 전송 도중 끊기면 `unknown`에서 실제 결과를 대조한 뒤 재시도한다 |

LemmaDuck의 실행 환경은 Linux x64, Node 22.19 이상, Paseo 0.14.0, OMP 18.14.2와 Pi 0.87.1이다. 구독 경로는 계정별로 검증한다. [Pi SDK](https://pi.dev/docs/latest/sdk) · [Oh My Pi](https://github.com/can1357/oh-my-pi) · [Claude 구독과 SDK](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) · [Google 인증](https://antigravity.google/docs/install)

Git/Jujutsu 상태는 태스크 체크포인트에 기록한다. `setup --full`은 Jujutsu 0.46.0을 체크섬 검증 후 설치한다. GitHub·Linear·Jira는 공식 MCP 프리셋과 계정별 도구 허용 목록을 사용하며, Pi와 Gemini에서 같은 연결 도구를 호출한다. OMP는 연결 CLI를 사용한다. 실제 계정 인증과 조직 권한 검수는 별도다. [라우팅](ROUTING.md) · [버전 관리](VCS.md) · [연결](CONNECTORS.md) · [글쓰기](WRITING.md)

## 3. pstack과 gstack을 전체로 탑재하는 방법

| 구성 | 고정한 범위 | 설계에서의 역할 |
| --- | --- | --- |
| pstack 0.15.36 | `cursor/plugins@c742dd6`의 `pstack/` 573개 파일, `harness/pstack/` 560개 파일, 생성·점검 스크립트와 마켓 인덱스 4개. 합계 1,137개 경로 | 58개 기본 스킬(원칙 스킬 24개 포함), `poteto-mode` 내부 플레이북 23개, 이름 있는 에이전트 2개와 참고자료·템플릿 전체 |
| pstack의 호스트별 기능 | Cursor 원본, 공식 Claude Code 변환본, 원본의 Benny 자동화 3개 하위 스킬. Benny는 위 기본 스킬 수와 별도 | `pstack:...` 이름공간. Cursor 전용 호스팅·Bugbot·Benny를 실행할 계정/기능을 확인한다. Pi/OMP/Codex 어댑터에는 같은 입출력·읽기 전용·분배·재개 시험을 적용한다 |
| gstack 1.92.10.0 | `garrytan/gstack@3f79d81`의 전체 Git 트리 4,528개 파일 경로. 실행 도구, 호스트 코드, 테스트, 자료·라이선스 포함 | `gstack:...` 이름공간. office-hours, 설계·엔지니어링 리뷰, 브라우저 QA, 배포·관찰·회고를 실제 소프트웨어/웹 프로젝트에 연결한다 |

같은 단어를 쓰는 명령은 출처까지 표시한다. 예를 들어 연구 질문은 pstack의 `sharpen`, 같은 전제를 공유하는 실패는 `principle-attack-the-premise`, 고정 지표의 개선 실험은 `hillclimb`, 채택 근거는 `show-me-your-work`에 연결한다. 웹앱 변경에서는 gstack의 설계 검토·브라우저 QA와 pstack의 `tdd`·`orchestrate`를 같은 이슈 아래 조합한다. 두 도구가 각각 PR·메일·배포를 독립 수행하지 않도록 하나의 실행 책임자와 영수증을 쓴다.

공식 Claude 트리는 일부 자동화와 자산을 원본에만 둔다. 커뮤니티 Pi 포트는 어댑터 참고 구현으로 기록하고 버전 차이를 점검한다. 기능별 판정은 **공식 호스트에서 실행 / 어댑터 검증 통과 / 다른 방식으로 기능 제공 / 호스트 필요**로 나눈다. Cursor 호스팅이나 사용자 계정이 필요한 기능은 그 의존성을 명시한다. [pstack 원본](https://github.com/cursor/plugins/tree/c742dd61706fbacc1b95f1a20b7b988cf096ce6c/pstack) · [공식 변환 범위](https://github.com/cursor/plugins/blob/main/harness/pstack/README.md) · [Benny](https://github.com/cursor/plugins/blob/main/pstack/automations/benny/README.md) · [커뮤니티 Pi 포트](https://github.com/bnema/pi-pstack) · [gstack](https://github.com/garrytan/gstack/tree/3f79d816730e8cd3633f31dc20351c0501ad958e)

번들의 `catalog/workflow-index.json`에서 기본 스킬·원칙·플레이북·에이전트·Benny 이름을 확인할 수 있다. `catalog/workflow-routing.tsv`는 pstack 항목 86개와 gstack의 정확한 이름이 `SKILL.md`인 71개 경로(테스트 fixture 포함)에 호스트·연결 방식·검증 시나리오를 대응한다. 표시한 시나리오는 검수할 설계 항목이다. `locks/pstack.tsv`, `locks/gstack.tsv`에는 파일별 경로·모드·Git blob ID·바이트 수가 있다. 원본을 가져오려면 **번들을 푼 위치에서** Git과 Python 3로 아래 명령을 실행한다. 새 디렉터리를 지정한다. `verify`는 이미 확보한 오프라인 Git 저장소에도 적용된다.

```sh
python3 tools/workflow_sources.py fetch pstack ./pstack-source
python3 tools/workflow_sources.py fetch gstack ./gstack-source
python3 tools/workflow_sources.py verify pstack ./pstack-source
```

## 4. 연구자가 실제로 쓰는 귀추·실험·논문화 루프

OpenAI가 공개한 자료에는 모델 추론 요약 10개와 원고·검증 자료·수정 이력이 있다. Mézard–Parisi 사례에서 같은 분기 구조로는 오차를 제어하기 어려워지자 **나무 내부의 분기 깊이를 한 단계 이동**하는 설명을 세우고, 새 구조에서 평균 오차를 따로 확인했다. 다른 사례에서는 공통 부호 오류로 종속 원고 세 편을 철회했다. 공개된 기록으로 확인할 수 있는 것은 이런 전환과 검증의 사례다. LemmaDuck의 귀추 절차는 이를 경험 연구에 적용하기 위해 설계한 것이다. [공개 범위](https://openai.com/index/sharing-ai-progress-in-mathematics/) · [분기 깊이 전환](https://github.com/openai/math/blob/4eaee87548250b2682affda7d05d947c05554bae/reasoning_traces/mezard-parisi-formula.tex) · [수정·철회 이력](https://github.com/openai/math/blob/4eaee87548250b2682affda7d05d947c05554bae/history.md)

| 단계 | 사람이 보거나 수정하는 산출물 | 진행 조건 |
| --- | --- | --- |
| 1. 관찰 | 예상과 다른 관찰, 대상·시간·분모, 출처, 해결할 질문. 사용자의 선호 설명은 별도 필드에 둔다 | 목표와 제약을 독립 탐색자에게 전달한다. 필요하면 선호 설명은 첫 가설 작성 후 공개한다 |
| 2. 탐색 | 정설·신생·오래 검증된 방법·인접 분야를 조사한 출처 노트. 반대 근거, 미사용 근거, 검색 실패·제외 사유도 남긴다 | 검색 결과에서 원문·코드·릴리스로 이동해 무엇을 실제로 확인했는지 기록한다 |
| 3. 경쟁 가설 | 서로 다른 기전과 각 기전이 맞을 때에만 기대하는 패턴, 무효 가설/측정 오류 가능성, 기각 조건 | 가설 간 예측이 겹치면 실험 설계를 고친다. 사람이 처음 제시하지 않은 설명도 같은 기준으로 심사한다 |
| 4. 판별 실험 | 가설을 가를 가장 작은 실험, 고정할 변수, 예산, 승인 데이터, 분석 코드 | 데이터 정의·버전·예측·평가 지표를 결과를 보기 전에 기록한다. 탐색 분석에는 그 상태를 표시한다 |
| 5. 반증·검증 | 독립 구현·반례·민감도 분석, 검증자 보고서, 지지/기각/미결 및 이유 | 모델 간 의견 일치와 독립 자료에서의 재현을 따로 기록한다. 수학에는 증명·Lean, 실증 연구에는 통계·외부검증을 사용한다 |
| 6. 논문화 | 근거가 붙은 claim, 결과표·그림·캡션, Methods·Results·한계·참고문헌·보충자료·수정 답변 | 모든 정량 문장은 표의 셀이나 실행 출력으로 돌아가야 한다. 입력이 바뀌면 영향받은 문장·그림·회신을 다시 검토한다 |

**예시 — 외부 기관에서 성능이 낮아진 TabEHR 모델.** 에이전트는 첫 설명을 “환자군이 다르다”로 확정하지 않는다. 경쟁 가설에 검사 단위 매핑 오류와 결과 정의의 차이도 둔다. 검사 매핑이 원인이면 같은 환자·모델·분할에서 해당 단위만 교정했을 때 그 검사를 쓰는 사례의 예측이 달라져야 한다. 결과 정의가 원인이면 결과 코드와 관찰 창을 맞출 때 평가 대상 또는 라벨이 달라져야 한다. 탐색용 자료에서 두 예측을 가른 후 고정된 정의와 코드로 봉인된 병원/기간을 평가한다. 표에는 분모·사건 수·성능·불확실성을 싣고 음성 결과도 남긴다. 이 예시는 검증할 연구 설계이며 실행 결과 수치를 가정하지 않는다.

**도구·문헌 탐색.** PubMed·OpenAlex·Crossref·arXiv로 논문과 인용 이력을, GitHub releases/commits/issues·HN/Show HN·CRAN Task Views·Repology로 구현·유지 이력을 살핀다. 웹 탐색 제공자는 `pi-web-providers`, `pi-web-access`, SearXNG, Marginalia 등으로 교체할 수 있다. 검색어를 유명 제품명에서 필요한 성질로 확장하고, 출시일과 최근 수정일을 따로 기록한다. Co-STORM처럼 아직 쓰지 않은 근거에서 후속 질문을 만든다. 탐색 로그와 채택 기록을 분리해 검색에 노출된 횟수가 기술 선정 점수가 되는 일을 막는다. [Co-STORM](https://github.com/stanford-oval/storm) · [Pi 검색 제공자](https://pi.dev/packages/pi-web-providers)

### 분야별 연구·개발 팩

| 팩 | 수행하는 일과 최종 산출물 |
| --- | --- |
| RECAP | 논문 PDF·보충자료의 숫자·표·그림·본문 주장을 대조한다. `claim_verification`과 문서 전체 `document_audit`를 분리한다. 결론, 원문 인용 위치/좌표, 계산, 불확실성, 기각 이유를 저장한다. OCR·표 해석이 불확실하면 판정 보류로 남긴다 |
| SCHERA · TabEHR/MedFM · ocular GVHD | 자연어 목표→OMOP 개념·코호트·권한 있는 SQL→집계 결과를 연결한다. 외부 검증은 기관과 시간 분할, 환자 누출, case mix, 측정 단위, outcome 정의, calibration을 확인한다. 예측·역학 질문마다 분석계획과 지표를 고정한다 |
| 분산 역학·통계 | federated propensity score, Cyclops·FeatureExtraction·DatabaseConnector·SqlRender, R/Python/SQL 파이프라인. 병원별 공변량 균형·가중치·overlap과 집계규칙을 기록하고 허용된 집계만 합친다. Windows Server 2022용 JDBC·ODBC 드라이버와 쿼리는 각각 실제 환경에서 검수한다 |
| 편집국·통계 심사 | 허용된 투고 시스템 인터페이스로 원고·보충자료를 받아 등록·파싱한다. 로컬 모델로 연구 요약/보고지침 검토와 통계 검토의 두 보고서를 만든다. 연구 유형에 맞춰 PICO/SPIDER, CONSORT·STROBE·STARD·PRISMA·MOOSE·AI 확장·TRIPOD 계열·CHAMP와 저널별 기준을 매핑한다. 편집자·통계심사자·동료심사자별 접근권, 검토와 발송, 3단계 실용적 무작위시험의 평가 기록까지 둔다 |
| 과학 출판 | 버전 고정한 SQL/R/Python/Jupyter에서 Quarto·Pandoc·LaTeX로 표·그림과 Word/PDF/TeX를 함께 빌드한다. 원자료 기반 그래프의 코드·단위·오차구간·캡션을 보관한다. DOI/서지정보·인용 근거, 저널 서식, rebuttal·정정 이력을 검수한다 |
| 소프트웨어·웹·인프라 | 서비스·웹사이트·다른 에이전트 개발을 이슈→재현→설계→구현→테스트→PR→배포→회고로 잇는다. 코드 에이전트는 격리 worktree에서 작업한다. Playwright 흐름, 접근성, 화면 비교, API 계약, CI 결과를 붙인다. SSH/GPU·Docker·Terraform plan과 AWS/GCP/Azure 환경도 같은 요청·결과 계약을 쓴다 |
| 에이전트 방법론 자체 | 기본 상태기계 또는 LangGraph, context compiler, evidence store, action selector, 도구 실행·검증·종료 모듈. Pi/OMP·공식 호스트·OpenClaw·Hermes와 로컬 Ollama/vLLM 워커를 동등 조건에서 비교한다. 전문 판정자, 민감도/특이도 개선자, 사례 요약자도 같은 프롬프트·결과 원장을 사용한다 |

벤치마크 카탈로그에는 RECAP용 SciClaimEval·SciTab·SciVer·PRISMM-Bench·FIND·FLAWS·PaperAudit-Bench 후보와 기존 검증기의 비교 슬롯을 둔다. 데이터의 공개·이용 조건과 정답의 단위를 먼저 확인한다. 주어진 오류만 주석된 문서에서는 주석 일치율과 실제 모든 오류의 재현율을 따로 보고한다. 일부 조건은 논문 단위 분할, 일부는 기관·기간 단위 외부시험을 요구한다. [OHDSI 도구군](https://ohdsi.github.io/Hades/) · [OpenClaw](https://github.com/openclaw/openclaw) · [Hermes](https://github.com/NousResearch/hermes-agent)

**하네스 개선 실험도 제품에 포함한다.** GEPA는 실행 피드백에서 프롬프트 후보를 만들고 Pareto 후보를 비교하는 경로, RRSI는 프롬프트·도구·제어 흐름을 포함한 하네스 편집을 정규화하는 경로, Dream-RSI는 기록된 탐색에서 탐색 정책을 비교하는 경로로 둔다. OPRO·ProTeGi·Promptbreeder 등은 프롬프트 기준선 슬롯에 둔다. 개발 세트에서 후보를 탐색하고, 실제 미관측 조건에서 다시 실행한 결과와 비용을 비교한 뒤 버전 승격 여부를 결정한다. 다른 하네스나 모델의 출력을 과거 기록 재생만으로 추정해 성능으로 발표하지 않는다. [GEPA](https://github.com/gepa-ai/gepa) · [RRSI](https://github.com/google-research/rrsi) · [Dream-RSI](https://dream-rsi.com/)

## 5. 업무·개인 비서와 한·영 작성

Dot에서 참고하는 동작은 한 창에서 요청을 맡기고, 연결된 서비스에서 처리하고, 결과·후속 일을 돌려받는 경험이다. LemmaDuck은 이 흐름에 프로젝트·계정·증거 ID를 붙인다. **업무 Gmail과 개인 Gmail, 업무 Drive와 개인 Drive는 각각 다른 연결이다.** ChatGPT에 이미 연결한 앱과 로컬 하네스의 자격증명도 각각 등록한다. [OpenAI Dot](https://help.openai.com/en/articles/20001530-getting-started-with-your-dot)

| 서비스 | 커넥터와 승인 범위 | 수행할 작업 |
| --- | --- | --- |
| Teams · Outlook · OneDrive/SharePoint · Microsoft Calendar | 조직 Microsoft Graph, delegated OAuth, tenant·채널·메일함·사이트/폴더 단위. 관리자 동의 요건을 점검한다 | 스레드·첨부 찾기, 답신 초안, 일정 조율, 문서 갱신, 허용 범위의 발송·초대 |
| Slack · Linear · Jira · GitHub | 공식 MCP/API, Slack workspace·Linear team·GitHub App 설치 repo별 권한 | 의사결정 추출, 이슈 생성·갱신, PR/체크 확인, 스레드 회신, 허용된 리뷰·병합 |
| Gmail · Google Drive/Docs · Google Calendar | Google OAuth, 계정별 토큰 저장소와 폴더·캘린더 범위 | 검색·제목/첨부 확인, 본인 문체의 초안·발송, 문서 편집, 일정 제안·초대 |
| YouTube · Google 검색 | YouTube Data API·허용 캡션/제공 파일, 공개 웹검색 어댑터 | 구독·플레이리스트·공개 메타데이터 조사, 영상/자막에 근거한 연구 노트. 개인 검색·시청 이력은 사용자가 별도로 제공한 자료만 다룬다 |
| Naver 검색·메일 · Daum 메일 | 공개검색 API와 메일 계정을 분리하고 메일함별 IMAP/SMTP 설정·앱 비밀번호 요건을 확인한다 | 검색·메일 분류·로컬 초안·승인된 SMTP 발송. 서버에서 제공하는 기능은 연결 시 탐지한다 |

이벤트는 webhook 또는 polling으로 받는다. 프로젝트 수신함에서 요청·마감·대기 중인 응답을 정리하고, 일정/이슈/문서 변경은 작업 ID를 공유한다. 답신·초대·파일 공유 시 미리 허용한 규칙 또는 해당 요청에서 준 권한을 적용하고 수신자·테넌트·첨부를 확인한다. 정책 범위 안의 반복 처리는 자동으로 완료하며, 범위 밖의 행위는 검토할 초안으로 남긴다. [Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview) · [Slack](https://docs.slack.dev/ai/slack-mcp-server/) · [Linear](https://linear.app/docs/mcp) · [GitHub](https://github.com/github/github-mcp-server) · [Gmail](https://developers.google.com/workspace/gmail/api/reference/rest) · [YouTube](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list) · [Naver 메일](https://help.naver.com/service/30029/contents/21344?lang=ko) · [Daum 메일](https://cs.daum.net/faq/service/43/category/9234/detail/35945)

**문체는 언어 × 장르 × 독자로 학습한다.** 본인이 승인한 발신메일·투고 원고·공지와 채택/거절한 수정 diff에서 한국어 높임말·마무리, 영어의 직접성·완곡성, 문단 길이, 선호 용어를 분리한다. 절차서에는 항공 정비문서에 쓰이는 ASD-STE100의 한 문장 한 동작, 명확한 동사, 같은 대상에 같은 용어 원칙을 적용한다. 한국어는 뜻에 맞게 적용하고, 논문은 인과/연관·효과 방향·조건·신뢰구간·불확실성을 보존한다. 한·영 간 숫자·부호·단위·비교군도 대조한다. 자동 린터가 지운 단어 수보다 저자가 살린 수정과 의미 변경 오류를 평가한다. [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) · [pstack technical-writing](https://github.com/cursor/plugins/blob/main/pstack/skills/technical-writing/SKILL.md)

**예시 — 연구 회신.** 두 기관의 단위 불일치와 금요일 회신 일정이 원자료에서 확인되었다고 하자. “당해 연구 추진 과정에서 발생한 사항에 관하여 공유드리고자 합니다”는 “두 기관의 검사 단위가 달랐습니다. 금요일까지 매핑표를 대조해 결과를 보내드리겠습니다”로 고친다. 영문 원고의 “X may be associated with Y”는 자료가 뒷받침하는 한 그대로 둔다. 예시는 가상의 입력이며 실제 사용자의 문체 프로필은 승인된 예문으로 교정한다.

## 6. 저장소 구조, 프로젝트 기록, 구현 순서

| 경로 계약 | 책임 |
| --- | --- |
| `apps/launcher`, `apps/cli`, `apps/web-gateway` | 플랫폼 설치·doctor, 동일 태스크를 여는 GUI/CLI, 인증·재접속 |
| `packages/core`, `packages/policy`, `packages/evidence` | 작업 상태기계, 실행 저널, 도구 권한, 원문 위치와 산출물 계보 |
| `adapters/{ui,runtimes,providers,connectors}` | OS·계정·호스트별 로그인과 기능 탐지, RPC/ACP/MCP, 표준화한 오류와 취소 |
| `workflows/{pstack,gstack,assistant,research,dev,writing,agentlab}` | 잠근 원본, 어댑터, 재현·대응 시험, 분야별 워크플로와 사용 예 |
| `profiles/{work,personal,public-research,restricted}`, `presets/` | 망·데이터·계정·발송 범위와 RECAP/OMOP/편집국/웹·운영 프로젝트 설정 |
| `bootstrap/`, `locks/`, `tests/{parity,e2e,offline,regression}`, `evals/` | Windows/Linux 설치와 오프라인 번들, 고정 버전, 비교·회귀·격리 수용시험 |
| `templates/project/`, `docs/` | `START_HERE.md`, `AGENTS.md`, 호스트별 지침, `DIALOGUE.md`, `TASK_M0.md`, `PLAN.md`, `REPORT_TEMPLATE.md`, `REPORT.md`와 운영 문서 |

프로젝트마다 `question.md`, `protocol.md`, `hypotheses.jsonl`, `decisions.tsv`, `claims.jsonl`, `runs/<run-id>/manifest.json`, `analysis/`, `figures/`, `paper/`를 쓴다. 재현 manifest에는 commit·데이터버전·ETL·concept set·분할·시드·모델/도구/프롬프트 버전을 담는다. 저장소에는 템플릿·비식별 예제·검증 코드가 들어간다. 실제 메일·문체 예문·OAuth 토큰·원고·환자 데이터·병원별 실행 로그는 권한 있는 프로젝트 저장소에 보관한다. 권한 토큰·비밀을 실행 프롬프트나 인계 패킷에 복사하지 않는다.

각 claim은 `claim_id → evidence_id → run_id 또는 source_id → table/figure/cell → manuscript_location`으로 조회된다. 예컨대 집계 쿼리의 버전이 바뀌면 영향받는 주장·그림·초안에 재계산 표시가 생긴다. 이미 발송한 답신에는 원본 영수증을 유지하고 정정 작업을 새로 등록한다.

**구현 순서**는 공통 코어와 작업 재개 → 양쪽 작업대와 전체 워크플로 원본/어댑터 → 업무·연구·개발·출판 및 비서 연결 → 기기·계정·폐쇄망 통합 검수다. 모든 단계는 이 최종 명세의 단일 릴리스 범위다. 사용자 계정이 필요한 기능은 코드, 모의 계약시험, 실제 권한 상태를 구분해 기록한다. 논문 제출·공유 여부는 저자의 결정으로 남긴다.

## 7. 수용시험

| 수용시험 | 통과 증거 |
| --- | --- |
| 설치와 기기 | 깨끗한 Windows x64/WSL2와 Ubuntu에서 설치·재설치·제거·복구를 검증한다. Surface ARM64와 Galaxy Tab에서 같은 원격 태스크를 이어 열고, 서버 중단/재개 여부를 표시한다 |
| 세 구독과 호스트 | 지정된 모델·계정·작업 권한이 유지된다. 한도·로그인 만료 시 유료 경로 호출 없이 중단하고 체크포인트를 복원한다. 브리지·호스트별 미지원 동작을 실제 동작과 구분한다 |
| pstack·gstack | 고정한 Git tree 및 경로/모드를 검사하고, 모든 스킬·플레이북에 호스트·필요 권한·테스트 상태를 할당한다. 실행 엔진이 다른 기능의 차이를 시험한다. Benny/클라우드와 배포 등 외부 동작은 권한 있는 테스트 환경에서 검수한다 |
| 업무 비서 | Teams 요청→허용 문서 확인→Linear 이슈→한·영 답신 초안을 한 작업으로 재현한다. 테스트 계정에서 발송 권한과 영수증, 웹훅 재전달 시 중복 방지, 계정 뒤섞기 차단을 확인한다 |
| 연구와 논문화 | 불일치 한 건에서 경쟁 가설·기각 조건을 작성하고, 합성자료로 분석→표→그림→원고를 다시 빌드한다. 원자료를 바꿔 하류 주장의 무효화와 수정 이력도 확인한다 |
| 개발과 에이전트 제작 | 재현 가능한 실패에서 출발해 웹/서비스 기능 구현→검증 PR→브라우저 증거→허용 배포와 롤백까지 검수한다. 새 MCP 도구나 모델 워커도 같은 실행/취소/검토 계약을 통과해야 한다 |
| 평가 설계 | 기준 설정과 실험 설정에 프로그래밍·연구·글쓰기 총 9과제 × 2조건 × 5회 = **90회**의 짝지은 비교를 설계한다. 모델·계정·도구 권한·입력 스냅샷을 고정하고 실행 순서와 블라인드 채점을 관리한다. 사전 정의한 품질 비열등성 기준을 먼저 평가하고, 그 후 전체 실행의 시간·보고된 토큰·비용·실패율을 비교한다 |
| 경계와 장애 | 프롬프트 주입, 다른 tenant 자료 조회, symlink·작업 루트 이탈, `.git/.jj/.ssh/.aws/.codex/.claude/.gemini/.env*`에 대한 에이전트 직접 접근, 민감 로그·원문 반출 차단을 검증한다. 허용된 Git 동작은 관리형 어댑터로 수행한다. 쓰기 중 타임아웃은 서비스 결과를 대조한다 |
| 폐쇄망 | 외부 DNS/HTTP 차단·클라우드 자격 부재 조건에서 승인된 로컬 워커·데이터·오프라인 패키지로 작업을 끝낸다. 드라이버·패키지 버전과 반출할 집계의 승인을 확인한다. 운영자의 파일럿이 필요한 항목은 증거를 받을 때까지 상태를 표시한다 |

## 8. 번들의 검증 범위

- `catalog/full.json`은 25개 기능 모듈, 6개 기기/호스트 경로, 8개 하네스/모델 연결 분류, 15개 플랫폼 연결 항목과 수용기준을 담는다.
- 두 upstream의 재귀 Git 목록은 잘림 없이 수집했다. 파일 목록에서 pstack 원본·공식 harness의 subtree 해시와 gstack 전체 root tree 해시를 재계산해 원본과 대조했다. 원본 소스 바이트는 동봉한 fetch 명령이 고정 커밋에서 가져온다. `verify`는 중복 파일을 포함한 모든 경로와 각 고유 blob의 내용을 대조한다.
- 검증 도구는 임시 Git 저장소에서 전체/부분 checkout, 바이너리·실행 비트·심볼릭 링크, 오프라인 재검증, 기존 경로 보호, 변조 목록 거절을 시험했다. 새 하네스의 실기기·조직 계정·폐쇄망 수용시험은 구현 릴리스의 항목이다.
