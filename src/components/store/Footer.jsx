import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.line}>HydroLeaf AB · Stockholm, Sweden</div>
            <div className={styles.line}>Hydroponically grown · Indoor controlled farming</div>
            <div className={styles.links}>
                <Link to="/contact">Contact</Link>
                <span aria-hidden="true">·</span>
                <Link to="/terms">Terms</Link>
                <span aria-hidden="true">·</span>
                <Link to="/privacy">Privacy</Link>
            </div>
            <div className={styles.line}>© 2025 HydroLeaf AB</div>
        </footer>
    );
}
