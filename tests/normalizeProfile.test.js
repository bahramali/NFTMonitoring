import { describe, expect, it } from 'vitest';
import normalizeProfile from '../src/utils/normalizeProfile.js';

describe('normalizeProfile', () => {
    it('maps picture_url to pictureUrl', () => {
        const profile = normalizeProfile({
            user: {
                id: 'user-1',
                email: 'user@example.com',
                picture_url: 'https://lh3.googleusercontent.com/a/image=s96-c',
            },
        });

        expect(profile.pictureUrl).toBe('https://lh3.googleusercontent.com/a/image=s96-c');
    });

    it('falls back to null when no picture field is provided', () => {
        const profile = normalizeProfile({ user: { id: 'user-2', email: 'user2@example.com' } });

        expect(profile.pictureUrl).toBeNull();
    });
});
