import { describe, expect, it } from 'vitest';
import { parseTrainingCertificate } from './training-certificate';

describe('training certificate labels', () => {
  it('reads spaced Korean labels, uses signer as issuer, and defaults both durations', () => {
    expect(parseTrainingCertificate([
      '과 정: 모형 조립 입문',
      '기 간: 2031.02.03. ~ 2031.03.04.',
      '상 시 학 습 인 정 시 간: 2시간45분',
      '위 사람은 가상연합모형교육원에서 실시한 교육을 이수했습니다.',
      '모형교육원장',
    ])).toMatchObject({
      course: '모형 조립 입문',
      institution: '모형교육원',
      begin: '20310203',
      end: '20310304',
      actual: { hours: 2, minutes: 45 },
      recognized: { hours: 2, minutes: 45 },
      content: undefined,
    });
  });

  it('keeps distinct explicit durations and reads only labeled content and institution', () => {
    expect(parseTrainingCertificate([
      '교육기관명: 가상 교육센터 발급기관: 가상 출판실',
      '실적시간: 3시간10분 인정시간: 50분',
      '교육내용:',
      '종이 모형 제작의 기초',
      '교육분류: 집합교육',
    ])).toMatchObject({
      institution: '가상 교육센터',
      actual: { hours: 3, minutes: 10 },
      recognized: { hours: 0, minutes: 50 },
      content: '종이 모형 제작의 기초',
    });
  });

  it('defaults an explicitly labeled training duration into both fields', () => {
    expect(parseTrainingCertificate(['교육시간: 75분'])).toMatchObject({
      actual: { hours: 1, minutes: 15 },
      recognized: { hours: 1, minutes: 15 },
    });
  });

  it('ignores invalid dates, conflicting durations and unspecified classifications', () => {
    const result = parseTrainingCertificate([
      '기간: 2031-02-29 ~ 2031-03-04',
      '인정시간: 1시간',
      '인정시간: 2시간',
      '실적시간: 1시간30분',
      '교육분류: 집합교육',
    ]);
    expect(result).toMatchObject({
      begin: undefined, end: undefined, recognized: undefined,
      actual: { hours: 1, minutes: 30 },
    });
    expect(result).not.toHaveProperty('classification');
  });
});
