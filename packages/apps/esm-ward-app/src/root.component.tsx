import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { getWardViewBasename } from './ward-route';
import WardView from './ward-view/ward-view.component';

const Root: React.FC = () => {
  // t('wards', 'Wards')
  const wardViewBasename = getWardViewBasename();

  return (
    <main>
      <BrowserRouter basename={wardViewBasename}>
        <Routes>
          <Route path="/" element={<WardView />} />
          <Route path="/:locationUuid" element={<WardView />} />
        </Routes>
      </BrowserRouter>
    </main>
  );
};

export default Root;
