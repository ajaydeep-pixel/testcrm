/**
 * Simple in-memory Redis mock for development (when Redis server is not available)
 * For production, use actual Redis server
 */

class RedisMemoryStore {
  constructor() {
    this.store = new Map();
    this.expiries = new Map();
  }

  async connect() {
    return this;
  }

  async set(key, value) {
    this.store.set(key, value);
    return 'OK';
  }

  async setEx(key, seconds, value) {
    this.store.set(key, value);
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }

  async sAdd(key, ...members) {
    if (!this.store.has(key)) {
      this.store.set(key, new Set());
    }
    const set = this.store.get(key);
    const flat = members.flat();
    flat.forEach(m => set.add(m));
    return flat.length;
  }

  async sMembers(key) {
    if (!this.store.has(key)) return [];
    return [...this.store.get(key)];
  }

  async get(key) {
    if (this.isExpired(key)) {
      this.store.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async del(key) {
    this.expiries.delete(key);
    return this.store.delete(key) ? 1 : 0;
  }

  async incrBy(key, increment = 1) {
    if (this.isExpired(key)) {
      this.store.delete(key);
    }
    const current = parseInt(this.store.get(key) || '0');
    const newVal = current + increment;
    this.store.set(key, newVal.toString());
    return newVal;
  }

  async incr(key) {
    return this.incrBy(key, 1);
  }

  async expire(key, seconds) {
    if (this.store.has(key)) {
      this.expiries.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key) {
    const expiry = this.expiries.get(key);
    if (!expiry) return -1;
    const remaining = Math.floor((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async zAdd(key, members) {
    // Handle both single object { score, member } and array [{ score, member }, ...]
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    const zset = this.store.get(key);
    
    // Normalize to array
    const memberArray = Array.isArray(members) ? members : [members];
    
    memberArray.forEach(({ score, member }) => {
      zset.set(member, score);
    });
    return memberArray.length;
  }

  async zRemRangeByScore(key, min, max) {
    if (!this.store.has(key)) return 0;
    const zset = this.store.get(key);
    let removed = 0;
    for (const [member, score] of zset) {
      if (score >= min && score <= max) {
        zset.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async zCard(key) {
    if (!this.store.has(key)) return 0;
    return this.store.get(key).size;
  }

  async zCount(key, min, max) {
    if (!this.store.has(key)) return 0;
    const zset = this.store.get(key);
    let count = 0;
    for (const [_, score] of zset) {
      if (score >= min && score <= max) count++;
    }
    return count;
  }

  isExpired(key) {
    const expiry = this.expiries.get(key);
    if (!expiry) return false;
    const isExpired = Date.now() > expiry;
    if (isExpired) {
      this.store.delete(key);
      this.expiries.delete(key);
    }
    return isExpired;
  }

  on(event, callback) {
    // Mock event listeners (no-op for in-memory store)
    return this;
  }

  async flushDb() {
    this.store.clear();
    this.expiries.clear();
    return 'OK';
  }

  async quit() {
    return 'OK';
  }

  async disconnect() {
    return 'OK';
  }
}

module.exports = RedisMemoryStore;
