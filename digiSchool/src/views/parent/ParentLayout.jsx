import React from 'react';
import { Outlet } from 'react-router-dom';

export default function ParentLayout() {
  return (
    <div className="parent-layout">
      {/* 
        The PortalLayout provides the sidebar and header. 
        This is just a local wrapper for the parent specific routes.
      */}
      <Outlet />
    </div>
  );
}
