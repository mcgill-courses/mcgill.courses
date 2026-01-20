import { Dialog, Transition } from '@headlessui/react';
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useMarkerRef,
} from '@vis.gl/react-google-maps';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

import * as buildingCodes from '../assets/building-codes.json';
import * as buildingCoordinates from '../assets/building-coordinates.json';
import { useDarkMode } from '../hooks/use-dark-mode';
import { env } from '../lib/env';

type MarkerProps = {
  position: google.maps.LatLngLiteral;
  buildingName: string;
};

const BuildingMarker = ({ position, buildingName }: MarkerProps) => {
  const [markerRef, marker] = useMarkerRef();

  return (
    <Fragment>
      <Marker ref={markerRef} position={position} />
      <InfoWindow anchor={marker}>
        <h2>{buildingName}</h2>
      </InfoWindow>
    </Fragment>
  );
};

type LocationProps = {
  title: string; // Adams Building, Agriculture & Technology labs, etc..
  code: string; // ADAMS, AGTECH, etc..
  open: boolean;
  onClose: () => void;
};

export const BuildingLocation = ({
  title,
  code,
  open,
  onClose,
}: LocationProps) => {
  const [darkMode] = useDarkMode();

  const building = {
    name: buildingCodes[code as keyof typeof buildingCodes],
    coordinates: buildingCoordinates[
      code as keyof typeof buildingCoordinates
    ] as google.maps.LatLngLiteral,
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as='div'
        className={twMerge('relative z-50', darkMode ? 'dark' : '')}
        onClose={onClose}
      >
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-200'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-black/25' />
        </Transition.Child>

        <div className='fixed inset-y-0 left-0 w-screen overflow-y-scroll'>
          <div className='flex min-h-full items-center justify-center p-4 text-center'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-200'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-150'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <Dialog.Panel className='size-[600px] overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-neutral-800'>
                <Dialog.Title
                  as='h3'
                  className='mb-4 text-lg leading-6 font-medium text-gray-900 dark:text-gray-200'
                >
                  {title}
                </Dialog.Title>
                <div className='relative w-full rounded-md bg-slate-50 shadow-sm dark:bg-neutral-800'>
                  <div>
                    <div style={{ height: 500 }}>
                      <APIProvider apiKey={env.VITE_GOOGLE_API_KEY}>
                        <Map
                          defaultCenter={building.coordinates}
                          defaultZoom={15}
                        >
                          <BuildingMarker
                            position={building.coordinates}
                            buildingName={building.name}
                          />
                        </Map>
                      </APIProvider>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
