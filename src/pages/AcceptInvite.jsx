import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { completeInvite, fetchInviteDetails } from '../api/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AcceptInvite.module.css';

export default function AcceptInvite() {
    const { logout } = useAuth();
    const { token: pathToken } = useParams();
    const [searchParams] = useSearchParams();
    const token = useMemo(() => (pathToken || searchParams.get('token') || '').trim(), [pathToken, searchParams]);

    const [inviteDetails, setInviteDetails] = useState(null);
    const [status, setStatus] = useState(token ? 'loading' : 'invalid');
    const [password, setPassword] = useState('');
    const [feedback, setFeedback] = useState(token ? '' : 'Invite token is missing.');

    useEffect(() => {
        logout({ redirect: false });
    }, [logout]);

    useEffect(() => {
        let active = true;
        if (!token) return () => { active = false; };

        const run = async () => {
            setStatus('loading');
            setFeedback('');
            try {
                const details = await fetchInviteDetails(token);
                if (!active) return;
                setInviteDetails(details);
                setStatus('ready');
            } catch (error) {
                if (!active) return;
                const message = error?.payload?.message || error?.message || 'Invite is invalid or expired.';
                setFeedback(message);
                setStatus('invalid');
            }
        };

        run();
        return () => {
            active = false;
        };
    }, [token]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (status !== 'ready') return;

        const trimmedPassword = password.trim();
        if (!trimmedPassword) {
            setFeedback('Password is required.');
            return;
        }

        if (trimmedPassword.length < 8) {
            setFeedback('Password must be at least 8 characters long.');
            return;
        }

        setStatus('submitting');
        setFeedback('');

        try {
            await completeInvite(token, trimmedPassword);
            setStatus('success');
        } catch (error) {
            const message = error?.payload?.message || error?.message || 'Could not complete invite.';
            setFeedback(message);
            setStatus('ready');
        }
    };

    const renderNotice = () => {
        if (status === 'loading') {
            return (
                <div className={styles.notice}>Validating your invitation…</div>
            );
        }

        if (status === 'invalid') {
            return (
                <div className={`${styles.notice} ${styles.noticeError}`}>
                    {feedback || 'This invite is invalid or has expired. Please ask a Super Admin to send a new one.'}
                </div>
            );
        }

        if (status === 'success') {
            return (
                <div className={`${styles.notice} ${styles.noticeSuccess}`}>
                    Your invite is confirmed. You can now <Link to="/login">sign in</Link> with your new password.
                </div>
            );
        }

        return null;
    };

    const inviteeLabel = inviteDetails?.email || inviteDetails?.invitee || null;

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Accept your admin invite</h1>
                <p className={styles.subtitle}>
                    Validate your invitation token, set a password, and finish activating your HydroLeaf admin account.
                </p>

                {renderNotice()}

                {status === 'ready' && inviteeLabel && (
                    <div className={styles.invitee}>Invitation for <strong>{inviteeLabel}</strong></div>
                )}

                {(status === 'ready' || status === 'submitting') && (
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <label className={styles.label} htmlFor="password">
                            Create your password
                            <span className={styles.labelHint}>(min. 8 characters)</span>
                        </label>
                        <input
                            id="password"
                            type="password"
                            className={styles.input}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            disabled={status === 'submitting'}
                            autoComplete="new-password"
                        />

                        {feedback && <div className={`${styles.notice} ${styles.noticeError}`}>{feedback}</div>}

                        <button type="submit" className={styles.button} disabled={status === 'submitting'}>
                            {status === 'submitting' ? 'Submitting…' : 'Set password and activate'}
                        </button>
                    </form>
                )}

                {status === 'success' && (
                    <div className={styles.helperText}>
                        Head to the login page and sign in with the email on this invite.
                        If you run into issues, ask a Super Admin to resend your invite.
                    </div>
                )}
            </div>
        </div>
    );
}
