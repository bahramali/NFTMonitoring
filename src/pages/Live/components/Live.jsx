import React from "react";
import NotesBlock from "./NotesBlock";
import TopicSection from "./TopicSection";
import styles from "./Live.module.css";

function Live({
    mergedDevices = {},
    systemTopics = {},
}) {
    const nonEmptyTopics = Object.fromEntries(
        Object.entries(systemTopics).filter(([, devices = {}]) => Object.keys(devices).length > 0)
    );

    return (
        <div className={styles.section}>
            <div className={styles.sectionBody}>
                {/* Notes based on mergedDevices */}
                <NotesBlock mergedDevices={mergedDevices}/>

                {/* Live status tables for non-germination topics */}
                {Object.keys(nonEmptyTopics).length > 0 && (
                    <div className={styles.topicSection}>
                        <TopicSection systemTopics={nonEmptyTopics}/>
                    </div>
                )}

            </div>
        </div>
    );
}

export default Live;
