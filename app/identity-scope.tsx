'use client';
import {createContext,useContext} from 'react';
export const IdentityScope=createContext('guest');
export function useIdentityScope(){return useContext(IdentityScope)}
