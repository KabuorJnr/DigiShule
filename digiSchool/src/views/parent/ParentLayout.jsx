import React from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';

export default function ParentLayout() {
  const context = useOutletContext();
  
  return (
    <div className="parent-layout">
      {/* 
        The PortalLayout provides the sidebar and header. 
        This is just a local wrapper for the parent specific routes.
      */}
      <Outlet context={context} />
    </div>
  );
}
