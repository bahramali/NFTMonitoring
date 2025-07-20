import React from 'react';
import HistoricalMultiBandChart from './HistoricalMultiBandChart';

const HistoricalBlueBandChart = (props) => (
    <HistoricalMultiBandChart {...props} bandKeys={['F1','F2','F3','F4']} />
);

export default React.memo(HistoricalBlueBandChart);
