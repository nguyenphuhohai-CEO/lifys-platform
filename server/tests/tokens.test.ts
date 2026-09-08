import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/lib/tokens';

describe('JWT token helpers', () => {
  const payload = { userId: 'user-123', email: 'test@example.com' };

  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('signs and verifies a refresh token round-trip', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('rejects a tampered access token', () => {
    const token = signAccessToken(payload);
    expect(() => verifyAccessToken(`${token}tampered`)).toThrow();
  });

  it('does not accept a refresh token as an access token', () => {
    const refreshToken = signRefreshToken(payload);
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});
