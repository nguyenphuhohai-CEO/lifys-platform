import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { normalizeEmail } from './auth.js';

const schemaFile = path.resolve(new URL('./postgres/schema.sql', import.meta.url).pathname);
const MODE_IDS = new Set(['amical', 'amoureux', 'sans-lendemain', 'mariage', 'professionnel']);

function now() {
  return new Date().toISOString();
}

function isFutureTimestamp(value) {
  return typeof value === 'string' && value > now();
}

function createPublicId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

function pairKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort((a, b) => a - b).join(':');
}

function normalizeInterests(value) {
  const items = Array.isArray(value) ? value : `${value ?? ''}`.split(',');

  return [...new Set(
    items
      .map((item) => `${item ?? ''}`.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function sanitizeProfileInput(value = {}) {
  const age = Number(value.age);
  const avatar = `${value.avatar ?? ''}`.trim();

  return {
    name: `${value.name ?? ''}`.trim(),
    age: Number.isFinite(age) && age >= 18 && age <= 80 ? age : null,
    city: `${value.city ?? ''}`.trim(),
    bio: `${value.bio ?? ''}`.trim(),
    interests: normalizeInterests(value.interests),
    mode: MODE_IDS.has(value.mode) ? value.mode : 'amoureux',
    avatar: avatar && /^https?:\/\//i.test(avatar) ? avatar : '',
  };
}

function parseInterests(value) {
  if (Array.isArray(value)) {
    return normalizeInterests(value);
  }

  try {
    return normalizeInterests(JSON.parse(`${value ?? '[]'}`));
  } catch {
    return [];
  }
}

function serializeProfile(row) {
  return {
    id: row.public_id,
    userId: Number(row.user_id),
    userPublicId: row.user_public_id,
    email: row.email,
    emailVerifiedAt: row.email_verified_at ?? null,
    name: row.name,
    age: row.age,
    city: row.city,
    bio: row.bio,
    interests: parseInterests(row.interests),
    mode: row.mode,
    avatar: row.avatar,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializePublicProfile(row) {
  return {
    id: row.public_id,
    name: row.name,
    age: row.age,
    city: row.city,
    bio: row.bio,
    interests: parseInterests(row.interests),
    mode: row.mode,
    avatar: row.avatar,
    isDemo: Boolean(row.is_demo),
  };
}

function serializeMatch(row) {
  return {
    id: row.match_public_id,
    profileId: row.profile_public_id,
    name: row.name,
    city: row.city,
    mode: row.mode,
    avatar: row.avatar,
    reason: row.reason,
    matchedAt: row.created_at,
  };
}

function buildMatchReason(currentProfile, targetProfile, hasReciprocalLike) {
  if (hasReciprocalLike) {
    return 'Like mutuel confirmé sur Lifys.';
  }

  if (currentProfile.mode === targetProfile.mode) {
    return `Même intention : ${currentProfile.mode}.`;
  }

  if (currentProfile.city && currentProfile.city.toLowerCase() === targetProfile.city.toLowerCase()) {
    return `Même ville : ${targetProfile.city}.`;
  }

  const sharedInterest = targetProfile.interests.find((interest) => currentProfile.interests.includes(interest));
  if (sharedInterest) {
    return `Centre d’intérêt partagé : ${sharedInterest}.`;
  }

  return 'Affinité démonstrative validée par le moteur de matching.';
}

async function ensurePostgresSchema(pool) {
  const existing = await pool.query(`SELECT to_regclass('public.users') AS users_table`);
  if (!existing.rows[0]?.users_table) {
    const schemaSql = await fs.readFile(schemaFile, 'utf8');
    await pool.query(schemaSql);
  }

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
    ALTER TABLE moderation_reports ADD COLUMN IF NOT EXISTS resolution_note TEXT NOT NULL DEFAULT '';
    ALTER TABLE moderation_reports ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
    ALTER TABLE moderation_reports ADD COLUMN IF NOT EXISTS handled_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_moderation_reports_status_created ON moderation_reports(status, created_at);
  `);
}

function mapModerationReport(row) {
  return {
    id: row.public_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolutionNote: row.resolution_note ?? '',
    createdAt: row.created_at,
    handledAt: row.handled_at ?? null,
    target: {
      userPublicId: row.target_user_public_id,
      profileId: row.target_profile_public_id,
      name: row.target_name,
      mode: row.target_mode,
      city: row.target_city,
      isDemo: Boolean(row.target_is_demo),
    },
    reporter: {
      userPublicId: row.reporter_user_public_id,
      profileId: row.reporter_profile_public_id,
      name: row.reporter_name,
      mode: row.reporter_mode,
      city: row.reporter_city,
      isDemo: Boolean(row.reporter_is_demo),
    },
    handledBy: row.handled_by_user_public_id
      ? {
        userPublicId: row.handled_by_user_public_id,
        email: row.handled_by_email,
      }
      : null,
  };
}

export async function createPostgresDatabase(config) {
  const { Pool } = await import('pg');
  const { DEMO_PROFILES } = await import('../src/data/demoData.js');
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: config.databaseSslRejectUnauthorized } : false,
    max: config.databasePoolMax,
    idleTimeoutMillis: config.databasePoolIdleTimeoutMs,
    connectionTimeoutMillis: config.databasePoolConnectionTimeoutMs,
  });

  await ensurePostgresSchema(pool);

  async function query(text, params = []) {
    return pool.query(text, params);
  }

  async function seedDemoData() {
    if (!config.demoDiscoveryEnabled) {
      return;
    }

    const existing = await query('SELECT COUNT(*)::int AS count FROM users WHERE is_demo = TRUE');
    if (existing.rows[0]?.count > 0) {
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const createdAt = now();
      for (const demoProfile of DEMO_PROFILES) {
        const insertedUser = await client.query(`
          INSERT INTO users (public_id, email, password_hash, email_verified_at, is_demo, role, created_at)
          VALUES ($1, $2, $3, $4, TRUE, 'member', $5)
          RETURNING id
        `, [
          `user-${demoProfile.id}`,
          `demo-${demoProfile.id}@lifys.local`,
          'demo-account',
          createdAt,
          createdAt,
        ]);

        await client.query(`
          INSERT INTO profiles (user_id, public_id, name, age, city, bio, interests, mode, avatar, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
        `, [
          insertedUser.rows[0].id,
          demoProfile.id,
          demoProfile.name,
          demoProfile.age,
          demoProfile.city,
          demoProfile.bio,
          JSON.stringify(normalizeInterests(demoProfile.interests)),
          demoProfile.mode,
          demoProfile.avatar,
          createdAt,
          createdAt,
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  await seedDemoData();

  async function getUserByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalizeEmail(email)]);
    return result.rows[0] ?? null;
  }

  async function getUserById(userId) {
    const result = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    return result.rows[0] ?? null;
  }

  async function getProfileByUserId(userId) {
    const result = await query(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.email_verified_at, users.is_demo
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.user_id = $1
      LIMIT 1
    `, [userId]);
    return result.rows[0] ? serializeProfile(result.rows[0]) : null;
  }

  async function getProfileByPublicId(profilePublicId) {
    const result = await query(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.email_verified_at, users.is_demo
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.public_id = $1
      LIMIT 1
    `, [profilePublicId]);
    return result.rows[0] ? serializeProfile(result.rows[0]) : null;
  }

  async function createUser({ email, passwordHash, name, mode = 'amoureux', role = 'member' }) {
    const createdAt = now();
    const userResult = await query(`
      INSERT INTO users (public_id, email, password_hash, email_verified_at, is_demo, role, created_at)
      VALUES ($1, $2, $3, NULL, FALSE, $4, $5)
      RETURNING id
    `, [createPublicId('user'), normalizeEmail(email), passwordHash, role, createdAt]);
    const userId = Number(userResult.rows[0].id);

    await query(`
      INSERT INTO profiles (user_id, public_id, name, age, city, bio, interests, mode, avatar, created_at, updated_at)
      VALUES ($1, $2, $3, NULL, '', '', '[]'::jsonb, $4, '', $5, $5)
    `, [userId, createPublicId('profile'), name, mode, createdAt]);

    return {
      userId,
      profile: await getProfileByUserId(userId),
    };
  }

  async function updateUserRole(userId, role) {
    await query('UPDATE users SET role = $2 WHERE id = $1', [userId, role]);
    return getUserById(userId);
  }

  async function updateUserProfile(userId, input) {
    const profile = sanitizeProfileInput(input);
    await query(`
      UPDATE profiles
      SET name = $2, age = $3, city = $4, bio = $5, interests = $6::jsonb, mode = $7, avatar = $8, updated_at = $9
      WHERE user_id = $1
    `, [userId, profile.name, profile.age, profile.city, profile.bio, JSON.stringify(profile.interests), profile.mode, profile.avatar, now()]);
    return getProfileByUserId(userId);
  }

  async function listDiscoveryProfiles(userId, filters = {}) {
    const hiddenResult = await query(`
      SELECT target_user_id AS id FROM likes WHERE user_id = $1
      UNION
      SELECT target_user_id AS id FROM passes WHERE user_id = $1
      UNION
      SELECT blocked_user_id AS id FROM user_blocks WHERE user_id = $1
      UNION
      SELECT user_id AS id FROM user_blocks WHERE blocked_user_id = $1
    `, [userId]);
    const hiddenUserIds = new Set(hiddenResult.rows.map((row) => Number(row.id)));
    const profilesResult = await query(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.email_verified_at, users.is_demo
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.user_id != $1
      ORDER BY users.is_demo DESC, profiles.updated_at DESC
    `, [userId]);

    const activeMode = `${filters.activeMode ?? 'all'}`;
    const searchQuery = `${filters.query ?? ''}`.trim().toLowerCase();
    const city = `${filters.city ?? ''}`.trim().toLowerCase();

    return profilesResult.rows
      .filter((row) => !hiddenUserIds.has(Number(row.user_id)))
      .map(serializePublicProfile)
      .filter((profile) => activeMode === 'all' || profile.mode === activeMode)
      .filter((profile) => !city || profile.city.toLowerCase().includes(city))
      .filter((profile) => {
        if (!searchQuery) {
          return true;
        }

        return [profile.name, profile.city, profile.bio, ...profile.interests]
          .join(' ')
          .toLowerCase()
          .includes(searchQuery);
      });
  }

  async function listMatchesForUser(userId) {
    const result = await query(`
      SELECT
        matches.public_id AS match_public_id,
        matches.reason,
        matches.created_at,
        profiles.public_id AS profile_public_id,
        profiles.name,
        profiles.city,
        profiles.mode,
        profiles.avatar
      FROM matches
      JOIN users ON users.id = CASE WHEN matches.user_one_id = $1 THEN matches.user_two_id ELSE matches.user_one_id END
      JOIN profiles ON profiles.user_id = users.id
      LEFT JOIN user_blocks AS direct_block ON direct_block.user_id = $1 AND direct_block.blocked_user_id = users.id
      LEFT JOIN user_blocks AS reverse_block ON reverse_block.user_id = users.id AND reverse_block.blocked_user_id = $1
      WHERE (matches.user_one_id = $1 OR matches.user_two_id = $1)
        AND direct_block.id IS NULL
        AND reverse_block.id IS NULL
      ORDER BY matches.created_at DESC
    `, [userId]);

    return result.rows.map(serializeMatch);
  }

  async function listMessagesForConversation(userId, conversationPublicId) {
    const result = await query(`
      SELECT messages.public_id, messages.content, messages.created_at, messages.sender_user_id
      FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      JOIN matches ON matches.id = conversations.match_id
      WHERE conversations.public_id = $1
        AND (matches.user_one_id = $2 OR matches.user_two_id = $2)
      ORDER BY messages.created_at ASC
    `, [conversationPublicId, userId]);

    return result.rows.map((message) => ({
      id: message.public_id,
      sender: Number(message.sender_user_id) === userId ? 'me' : 'them',
      text: message.content,
      createdAt: message.created_at,
    }));
  }

  async function listConversationsForUser(userId) {
    const result = await query(`
      SELECT
        conversations.public_id AS conversation_public_id,
        matches.public_id AS match_public_id,
        profiles.public_id AS profile_public_id,
        profiles.name,
        profiles.mode,
        profiles.avatar,
        profiles.city
      FROM conversations
      JOIN matches ON matches.id = conversations.match_id
      JOIN users ON users.id = CASE WHEN matches.user_one_id = $1 THEN matches.user_two_id ELSE matches.user_one_id END
      JOIN profiles ON profiles.user_id = users.id
      LEFT JOIN user_blocks AS direct_block ON direct_block.user_id = $1 AND direct_block.blocked_user_id = users.id
      LEFT JOIN user_blocks AS reverse_block ON reverse_block.user_id = users.id AND reverse_block.blocked_user_id = $1
      WHERE (matches.user_one_id = $1 OR matches.user_two_id = $1)
        AND direct_block.id IS NULL
        AND reverse_block.id IS NULL
      ORDER BY conversations.created_at DESC
    `, [userId]);

    return Promise.all(result.rows.map(async (conversation) => ({
      id: conversation.conversation_public_id,
      matchId: conversation.match_public_id,
      profileId: conversation.profile_public_id,
      name: conversation.name,
      mode: conversation.mode,
      avatar: conversation.avatar,
      city: conversation.city,
      messages: await listMessagesForConversation(userId, conversation.conversation_public_id),
    })));
  }

  async function getOrCreateMatch(userId, targetUserId, currentProfile, targetProfile) {
    const reciprocalLike = await query('SELECT 1 FROM likes WHERE user_id = $1 AND target_user_id = $2 LIMIT 1', [targetUserId, userId]);
    const createdAt = now();
    const key = pairKey(userId, targetUserId);
    const reason = buildMatchReason(currentProfile, targetProfile, Boolean(reciprocalLike.rows[0]));
    await query(`
      INSERT INTO matches (public_id, pair_key, user_one_id, user_two_id, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (pair_key) DO NOTHING
    `, [createPublicId('match'), key, Math.min(userId, targetUserId), Math.max(userId, targetUserId), reason, createdAt]);

    const matchRow = await query('SELECT * FROM matches WHERE pair_key = $1 LIMIT 1', [key]);
    const matchId = Number(matchRow.rows[0].id);
    await query(`
      INSERT INTO conversations (public_id, match_id, created_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (match_id) DO NOTHING
    `, [createPublicId('conversation'), matchId, createdAt]);

    const conversationRow = await query('SELECT * FROM conversations WHERE match_id = $1 LIMIT 1', [matchId]);
    const conversationId = conversationRow.rows[0].public_id;
    const existingMessages = await listMessagesForConversation(userId, conversationId);
    if (existingMessages.length === 0) {
      await query(`
        INSERT INTO messages (public_id, conversation_id, sender_user_id, content, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [createPublicId('message'), matchId ? Number(conversationRow.rows[0].id) : null, targetUserId, `Bonjour ${currentProfile.name || 'et bienvenue'} ! Ce premier message confirme votre match Lifys.`, createdAt]);
    }

    return {
      match: (await listMatchesForUser(userId)).find((item) => item.id === matchRow.rows[0].public_id) ?? null,
      conversationId,
    };
  }

  async function likeProfile(userId, profilePublicId) {
    const currentProfile = await getProfileByUserId(userId);
    const targetProfile = await getProfileByPublicId(profilePublicId);
    if (!currentProfile || !targetProfile || targetProfile.userId === userId) {
      return { matched: false, match: null, conversationId: null };
    }

    await query('INSERT INTO likes (user_id, target_user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, target_user_id) DO NOTHING', [userId, targetProfile.userId, now()]);
    await query('DELETE FROM passes WHERE user_id = $1 AND target_user_id = $2', [userId, targetProfile.userId]);

    const reciprocal = Boolean((await query('SELECT 1 FROM likes WHERE user_id = $1 AND target_user_id = $2 LIMIT 1', [targetProfile.userId, userId])).rows[0]);
    const sameMode = currentProfile.mode === targetProfile.mode;
    const sameCity = currentProfile.city && currentProfile.city.toLowerCase() === targetProfile.city.toLowerCase();
    const sharedInterest = targetProfile.interests.some((interest) => currentProfile.interests.includes(interest));
    const shouldMatch = reciprocal || sameMode || sameCity || sharedInterest || targetProfile.isDemo;
    if (!shouldMatch) {
      return { matched: false, match: null, conversationId: null };
    }

    const result = await getOrCreateMatch(userId, targetProfile.userId, currentProfile, targetProfile);
    return { matched: true, ...result };
  }

  async function passProfile(userId, profilePublicId) {
    const targetProfile = await getProfileByPublicId(profilePublicId);
    if (!targetProfile || targetProfile.userId === userId) {
      return false;
    }

    await query('INSERT INTO passes (user_id, target_user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, target_user_id) DO NOTHING', [userId, targetProfile.userId, now()]);
    return true;
  }

  async function addMessage(userId, conversationPublicId, text) {
    const context = await query(`
      SELECT conversations.id, conversations.public_id, matches.user_one_id, matches.user_two_id
      FROM conversations
      JOIN matches ON matches.id = conversations.match_id
      WHERE conversations.public_id = $1
      LIMIT 1
    `, [conversationPublicId]);
    const conversation = context.rows[0];
    if (!conversation || (Number(conversation.user_one_id) !== userId && Number(conversation.user_two_id) !== userId)) {
      return null;
    }

    await query(`
      INSERT INTO messages (public_id, conversation_id, sender_user_id, content, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [createPublicId('message'), Number(conversation.id), userId, `${text}`.trim(), now()]);
    return (await listConversationsForUser(userId)).find((item) => item.id === conversationPublicId) ?? null;
  }

  async function createAuditLog({ actorUserId = null, targetUserId = null, action, metadata = {} }) {
    await query(`
      INSERT INTO audit_logs (public_id, actor_user_id, target_user_id, action, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `, [createPublicId('audit'), actorUserId, targetUserId, action, JSON.stringify(metadata), now()]);
  }

  async function createRefreshToken(userId, tokenHash, expiresAt) {
    await query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at)
      VALUES ($1, $2, $3, $4, NULL)
    `, [userId, tokenHash, expiresAt, now()]);
  }

  async function getRefreshToken(tokenHash) {
    const result = await query('SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1', [tokenHash]);
    const session = result.rows[0];
    if (!session || session.revoked_at || !isFutureTimestamp(session.expires_at)) {
      return null;
    }
    return session;
  }

  async function rotateRefreshToken(currentTokenHash, nextTokenHash, nextExpiresAt) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1', [currentTokenHash]);
      const session = result.rows[0];
      if (!session || session.revoked_at || !isFutureTimestamp(session.expires_at)) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('UPDATE refresh_tokens SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL', [currentTokenHash, now()]);
      await client.query(`
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at)
        VALUES ($1, $2, $3, $4, NULL)
      `, [session.user_id, nextTokenHash, nextExpiresAt, now()]);
      await client.query('COMMIT');
      return Number(session.user_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function revokeRefreshToken(tokenHash) {
    await query('UPDATE refresh_tokens SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash, now()]);
  }

  async function revokeRefreshTokensForUser(userId) {
    await query('UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [userId, now()]);
  }

  async function createEmailVerificationToken(userId, tokenHash, expiresAt) {
    await query('UPDATE email_verification_tokens SET used_at = $2 WHERE user_id = $1 AND used_at IS NULL', [userId, now()]);
    await query(`
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at, used_at)
      VALUES ($1, $2, $3, $4, NULL)
    `, [userId, tokenHash, expiresAt, now()]);
  }

  async function verifyEmailToken(tokenHash) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM email_verification_tokens WHERE token_hash = $1 LIMIT 1', [tokenHash]);
      const record = result.rows[0];
      if (!record || record.used_at || !isFutureTimestamp(record.expires_at)) {
        await client.query('ROLLBACK');
        return null;
      }
      const verifiedAt = now();
      await client.query('UPDATE email_verification_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL', [tokenHash, verifiedAt]);
      await client.query('UPDATE users SET email_verified_at = $2 WHERE id = $1', [record.user_id, verifiedAt]);
      await client.query('COMMIT');
      return getUserById(Number(record.user_id));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function createPasswordResetToken(userId, tokenHash, expiresAt) {
    await query('UPDATE password_reset_tokens SET used_at = $2 WHERE user_id = $1 AND used_at IS NULL', [userId, now()]);
    await query(`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at, used_at)
      VALUES ($1, $2, $3, $4, NULL)
    `, [userId, tokenHash, expiresAt, now()]);
  }

  async function resetPasswordWithToken(tokenHash, passwordHash) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1', [tokenHash]);
      const record = result.rows[0];
      if (!record || record.used_at || !isFutureTimestamp(record.expires_at)) {
        await client.query('ROLLBACK');
        return null;
      }
      const consumedAt = now();
      await client.query('UPDATE password_reset_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL', [tokenHash, consumedAt]);
      await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [record.user_id, passwordHash]);
      await client.query('UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [record.user_id, consumedAt]);
      await client.query('COMMIT');
      return getUserById(Number(record.user_id));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function resetUserData(userId) {
    await query(`
      DELETE FROM matches
      WHERE id IN (
        SELECT matches.id
        FROM matches
        JOIN users AS other_user ON other_user.id = CASE
          WHEN matches.user_one_id = $1 THEN matches.user_two_id
          ELSE matches.user_one_id
        END
        WHERE (matches.user_one_id = $1 OR matches.user_two_id = $1)
          AND other_user.is_demo = TRUE
      )
    `, [userId]);
    await query('DELETE FROM likes WHERE user_id = $1', [userId]);
    await query('DELETE FROM passes WHERE user_id = $1', [userId]);
    await query(`
      UPDATE profiles
      SET name = 'Profil Lifys', age = NULL, city = '', bio = '', interests = '[]'::jsonb, mode = 'amoureux', avatar = '', updated_at = $2
      WHERE user_id = $1
    `, [userId, now()]);
  }

  async function blockProfile(userId, profilePublicId, reason = '') {
    const targetProfile = await getProfileByPublicId(profilePublicId);
    if (!targetProfile || targetProfile.userId === userId) {
      return null;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO user_blocks (user_id, blocked_user_id, reason, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, blocked_user_id) DO NOTHING
      `, [userId, targetProfile.userId, `${reason}`.trim(), now()]);
      await client.query('DELETE FROM likes WHERE user_id = $1 AND target_user_id = $2', [userId, targetProfile.userId]);
      await client.query('DELETE FROM likes WHERE user_id = $1 AND target_user_id = $2', [targetProfile.userId, userId]);
      await client.query('DELETE FROM passes WHERE user_id = $1 AND target_user_id = $2', [userId, targetProfile.userId]);
      await client.query('DELETE FROM passes WHERE user_id = $1 AND target_user_id = $2', [targetProfile.userId, userId]);
      await client.query('DELETE FROM matches WHERE pair_key = $1', [pairKey(userId, targetProfile.userId)]);
      await client.query(`
        INSERT INTO audit_logs (public_id, actor_user_id, target_user_id, action, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      `, [createPublicId('audit'), userId, targetProfile.userId, 'user.blocked', JSON.stringify({ profilePublicId: targetProfile.id, reason: `${reason}`.trim() }), now()]);
      await client.query('COMMIT');
      return serializePublicProfile(targetProfile);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function reportProfile(userId, profilePublicId, reason, details = '') {
    const targetProfile = await getProfileByPublicId(profilePublicId);
    if (!targetProfile || targetProfile.userId === userId) {
      return null;
    }
    const reportId = createPublicId('report');
    await query(`
      INSERT INTO moderation_reports (public_id, reporter_user_id, target_user_id, reason, details, status, resolution_note, created_at)
      VALUES ($1, $2, $3, $4, $5, 'open', '', $6)
    `, [reportId, userId, targetProfile.userId, `${reason}`.trim(), `${details}`.trim(), now()]);
    await createAuditLog({
      actorUserId: userId,
      targetUserId: targetProfile.userId,
      action: 'profile.reported',
      metadata: { reportId, profilePublicId: targetProfile.id, reason: `${reason}`.trim() },
    });
    return { id: reportId, status: 'open' };
  }

  async function listModerationReports(status = 'open', limit = 50) {
    const params = [];
    let whereClause = '';
    if (status && status !== 'all') {
      params.push(status);
      whereClause = `WHERE reports.status = $${params.length}`;
    }
    params.push(limit);

    const result = await query(`
      SELECT
        reports.public_id,
        reports.reason,
        reports.details,
        reports.status,
        reports.resolution_note,
        reports.created_at,
        reports.handled_at,
        target_user.public_id AS target_user_public_id,
        target_user.is_demo AS target_is_demo,
        target_profile.public_id AS target_profile_public_id,
        target_profile.name AS target_name,
        target_profile.mode AS target_mode,
        target_profile.city AS target_city,
        reporter_user.public_id AS reporter_user_public_id,
        reporter_user.is_demo AS reporter_is_demo,
        reporter_profile.public_id AS reporter_profile_public_id,
        reporter_profile.name AS reporter_name,
        reporter_profile.mode AS reporter_mode,
        reporter_profile.city AS reporter_city,
        handled_by.public_id AS handled_by_user_public_id,
        handled_by.email AS handled_by_email
      FROM moderation_reports AS reports
      JOIN users AS target_user ON target_user.id = reports.target_user_id
      JOIN profiles AS target_profile ON target_profile.user_id = target_user.id
      JOIN users AS reporter_user ON reporter_user.id = reports.reporter_user_id
      JOIN profiles AS reporter_profile ON reporter_profile.user_id = reporter_user.id
      LEFT JOIN users AS handled_by ON handled_by.id = reports.handled_by_user_id
      ${whereClause}
      ORDER BY reports.created_at DESC
      LIMIT $${params.length}
    `, params);

    return result.rows.map(mapModerationReport);
  }

  async function resolveModerationReport(reportPublicId, moderatorUserId, status, resolutionNote = '') {
    const result = await query(`
      UPDATE moderation_reports
      SET status = $2, resolution_note = $3, handled_at = $4, handled_by_user_id = $5
      WHERE public_id = $1
      RETURNING public_id
    `, [reportPublicId, status, `${resolutionNote}`.trim(), now(), moderatorUserId]);
    if (!result.rows[0]) {
      return null;
    }
    await createAuditLog({
      actorUserId: moderatorUserId,
      action: 'moderation.report.updated',
      metadata: { reportId: reportPublicId, status, resolutionNote: `${resolutionNote}`.trim() },
    });
    return (await listModerationReports('all', 200)).find((item) => item.id === reportPublicId) ?? null;
  }

  async function deleteUserAccount(userId) {
    const profile = await getProfileByUserId(userId);
    const user = await getUserById(userId);
    if (!profile) {
      return null;
    }
    await createAuditLog({
      action: 'account.deleted',
      metadata: {
        deletedUserId: userId,
        profilePublicId: profile.id,
        emailHash: user?.email ? crypto.createHash('sha256').update(user.email).digest('hex') : null,
      },
    });
    await query('DELETE FROM users WHERE id = $1', [userId]);
    return profile;
  }

  return {
    pool,
    config,
    createUser,
    updateUserRole,
    getUserByEmail,
    getUserById,
    getProfileByUserId,
    getProfileByPublicId,
    updateUserProfile,
    listDiscoveryProfiles,
    likeProfile,
    passProfile,
    listMatchesForUser,
    listConversationsForUser,
    addMessage,
    createRefreshToken,
    getRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    revokeRefreshTokensForUser,
    createEmailVerificationToken,
    verifyEmailToken,
    createPasswordResetToken,
    resetPasswordWithToken,
    resetUserData,
    blockProfile,
    reportProfile,
    listModerationReports,
    resolveModerationReport,
    deleteUserAccount,
    createAuditLog,
    getMigrationState() {
      return [{ name: 'postgres/schema.sql', applied_at: null }];
    },
    getHealthState() {
      return {
        provider: 'postgres',
        demoDiscoveryEnabled: Boolean(config.demoDiscoveryEnabled),
        migrationCount: 1,
        latestMigration: 'postgres/schema.sql',
      };
    },
    async close() {
      await pool.end();
    },
  };
}
