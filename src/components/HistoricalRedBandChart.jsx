import React from 'react';
import HistoricalMultiBandChart from './HistoricalMultiBandChart';

const HistoricalRedBandChart = (props) => (
    <HistoricalMultiBandChart {...props} bandKeys={['F5','F6','F7','F8','nir']} />
);

export default React.memo(HistoricalRedBandChart);
