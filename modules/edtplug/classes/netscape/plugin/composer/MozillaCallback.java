/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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

package netscape.plugin.composer;

import java.io.*;


/** Allows Java to call back into the Mozilla thread.
 * This is a general purpose utility, not just a
 * composer-specific utility. It should be in some standard place.
 * To use, Create the callback, then enqueue it.
 */

abstract class MozillaCallback {
    public MozillaCallback(int mozenv){
        this.mozenv = mozenv;
    }
    /** Equeues the callback method.
     */
    public void enqueue(){
        pEnqueue(mozenv);
    }

    /** Override to perform an action in the Mozilla thread.
     */

    abstract protected void perform();

    private native void pEnqueue(int mozenv);
    private int mozenv;
}
