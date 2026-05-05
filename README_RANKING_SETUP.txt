MONSTARZ RUN 랭킹 설정

1) 기존 프로젝트 루트에 이 파일들을 덮어쓰기/추가
- index.html
- api/get-scores.js
- api/save-score.js
- data/scores.json
- vercel.json

2) 기존 assets/ 와 audio/ 폴더는 그대로 유지
- assets/player_monstarz.png
- assets/coin_*.png
- assets/power_item.png
- audio/bgm_loop.mp3
- audio/jump.wav
- audio/coin.wav
- audio/hit.wav
- audio/gameover.wav

3) Vercel 환경변수
GITHUB_TOKEN=깃허브 토큰
GITHUB_OWNER=kill662477-cmyk
GITHUB_REPO=monstarzrun
GITHUB_BRANCH=main
SCORE_PATH=data/scores.json

4) GitHub 토큰 권한
- 해당 repo contents read/write 가능한 Fine-grained token 권장
- 토큰은 절대 index.html에 넣지 말고 Vercel 환경변수에만 입력

5) 동작
- 게임 종료 시 TOP10 표시
- TOP10 진입 시 닉네임 입력창 표시
- 동일 닉네임은 더 높은 기록만 남김
