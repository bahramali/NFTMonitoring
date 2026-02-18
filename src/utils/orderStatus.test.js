import { describe, expect, it } from 'vitest';
import { mapOrderStatus, resolveOrderPrimaryAction } from './orderStatus.js';

describe('orderStatus utilities', () => {
    it('maps CANCELLED_BY_CUSTOMER to a cancelled read-only state', () => {
        const meta = mapOrderStatus('CANCELLED_BY_CUSTOMER');
        expect(meta.label).toBe('Cancelled');
        expect(meta.badgeVariant).toBe('neutral');
        expect(meta.primaryActionType).toBe('view-order');
    });

    it('does not expose payment retry actions for CANCELLED_BY_CUSTOMER', () => {
        const action = resolveOrderPrimaryAction('CANCELLED_BY_CUSTOMER');
        expect(action.type).toBe('view-order');
        expect(action.label).toBe('View order');
    });
});
