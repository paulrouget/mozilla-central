/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 */

#ifndef nsIDrawingSurfaceMac_h___
#define nsIDrawingSurfaceMac_h___

#include "nsIDrawingSurface.h"
#include "nsIWidget.h"
#include <QDOffscreen.h>

class GraphicsState;

// windows specific drawing surface method set

#define NS_IDRAWING_SURFACE_MAC_IID   \
{ 0x1ed958b0, 0xcab6, 0x11d2, \
{ 0xa8, 0x49, 0x00, 0x40, 0x95, 0x9a, 0x28, 0xc9 } }

class nsIDrawingSurfaceMac : public nsISupports
{
public:
  /**
   * Initialize a drawing surface using a Macintosh GrafPtr.
   * aPort is not owned by this drawing surface, just used by it.
   * @param  aPort GrafPtr to initialize drawing surface with
   * @return error status
   **/
  NS_IMETHOD Init(nsDrawingSurface aDS) = 0;

  /**
   * Initialize a drawing surface using a Macintosh GrafPtr.
   * aPort is not owned by this drawing surface, just used by it.
   * @param  aPort GrafPtr to initialize drawing surface with
   * @return error status
   **/
  NS_IMETHOD Init(GrafPtr aPort) = 0;

  /**
   * Initialize a drawing surface using a nsIWidget.
   * aTheWidget is not owned by this drawing surface, just used by it.
   * @param  aTheWidget a nsWidget that contains the GrafPtr and all the data needed
   * @return error status
   **/
	NS_IMETHOD Init(nsIWidget *aTheWidget) = 0;

  /**
   * Create and initialize an offscreen drawing surface 
	 * @param  aDepth depth of the offscreen drawing surface
   * @param  aWidth width of the offscreen drawing surface
   * @param  aHeight height of the offscren drawing surface
   * @param  aFlags flags used to control type of drawing surface created
   * @return error status
   **/
  NS_IMETHOD Init(PRUint32 aDepth, PRUint32 aWidth, PRUint32 aHeight,PRUint32 aFlags) = 0;

  /**
   * Get a Macintosh GrafPtr that represents the drawing surface.
   * @param  aPort out parameter for GrafPtr
   * @return error status
   **/
  NS_IMETHOD GetGrafPtr(GrafPtr *aPort) = 0;

};

#endif  // nsIDrawingSurfaceMac_h___ 
