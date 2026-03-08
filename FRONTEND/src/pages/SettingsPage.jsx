import React from 'react';
import SettingsMenu from '../components/SettingsMenu';
import TenantCommonHeader from '../components/TenantCommonHeader';
import SuperadminReturnBar from '../components/SuperadminReturnBar';

export default function SettingsPage() {
  return (
    <>
      <SuperadminReturnBar />
      <TenantCommonHeader />
      <SettingsMenu />
    </>
  );
}
