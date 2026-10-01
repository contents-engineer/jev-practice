# 다이어그램 검증 기록

- diagram_type: workflow
- output: docs/diagrams/emotion-face.html
- specification_sha256: `2c7c481531a5c39984cc47b7fda16a3fee594c0a44f8a7b0c00c85e71a4a49f5`
- specification_bytes: 3641
- artifact_sha256: `6bc47f7207543210cdb7eac71e40464204fe8b9b216a9ad4398262c2febadc98`
- artifact_bytes: 717890
- validation: 9/9 showcase, 0 errors, 0 warnings
- browser_evidence: passed
- visual_review: failed — 큰 화면에서 하단 여백이 많이 남아 화면 전체의 균형 기준은 충족하지 못함. 확인한 스크린샷에서 노드·문구 겹침이나 잘림은 보이지 않음.
- correction_rounds: 2

Chrome 자동 검사에서 1440×900, 1600×1000, 1920×1080, 2048×1320의 가로·세로 넘침과 가독성 검사를 통과했다. 1440×900과 2048×1320의 밝은/어두운 테마 스크린샷을 생성했다. 이미지 검토는 2048×1320 밝은 테마와 1440×900 어두운 테마를 대상으로 수행했다. 실제 검색·포커스·내보내기 조작은 별도로 검증하지 않았다.

여백 개선을 위한 두 차례의 세로 간격 조정은 범례와 연결선 충돌로 통과하지 못했다. 최종 JSON을 검증된 원본 바이트로 복원했으며, 전달 HTML과 자동 브라우저 증거는 기존 검증본 그대로다. 자동 검증 통과를 시각적 완성도 통과로 간주하지 않는다.

- [자동 검사 원본](emotion-face.visual-check.json)
- [화면 비교](emotion-face.visual-check.html)

Archify 스킬의 제한인 “never exceed a maximum of two focused correction rounds”에 따라 추가 시각 보정은 중단했다. 기능과 내용은 사용할 수 있으며, 남은 문제는 큰 화면에서의 여백이다.
