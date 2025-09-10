"use client";

import React, { createContext, useContext } from 'react';

type Dict = Record<string, string>;

const enUS: Dict = {
  nav_dashboard: 'Dashboard',
  nav_circles: 'Circles',
  nav_slotshop: 'SlotShop',
  nav_connect: 'Public Good',
  nav_bookings: 'Bookings',
  nav_map: 'Map',
  nav_calendar: 'Calendar',
  nav_treasury: 'Treasury',
  nav_pro: 'Pro',
  actions_download_poster: 'Download Poster',
  booking_start_session: 'Start Session',
  booking_finish_session: 'Finish Session',
};

type I18nContextType = { t: (key: string) => string };
const I18nContext = createContext<I18nContextType>({ t: (k) => k });

export function I18nProvider({ children, dict = enUS }: { children: React.ReactNode; dict?: Dict }) {
  const t = (key: string) => dict[key] || key;
  return <I18nContext.Provider value={{ t }}>{children}</I18nContext.Provider>;
}

export function useT() { return useContext(I18nContext).t; }

export const defaultDict = enUS;

