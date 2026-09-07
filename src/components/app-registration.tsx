'use client';
import {useEffect} from 'react';
export function AppRegistration(){useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);return null;}
