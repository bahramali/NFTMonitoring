import React from 'react';
import HistoricalMultiBandChart from './HistoricalMultiBandChart';

const HistoricalClearLuxChart = (props) => (
    <HistoricalMultiBandChart {...props} bandKeys={['clear','lux']} />
);

export default React.memo(HistoricalClearLuxChart);
