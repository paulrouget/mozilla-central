/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: NPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is 
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or 
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the NPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the NPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


// DO NOT COPY THIS CODE INTO YOUR SOURCE!  USE NS_IMPL_NSGETMODULE()

#include "nsGenericFactory.h"
#include "nsMemory.h"
#include "nsCOMPtr.h"
#include "nsIComponentManager.h"
#include "nsIComponentRegistrar.h"

nsGenericFactory::nsGenericFactory(const nsModuleComponentInfo *info)
    : mInfo(info)
{
    NS_INIT_ISUPPORTS();
    if (mInfo && mInfo->mClassInfoGlobal)
        *mInfo->mClassInfoGlobal = NS_STATIC_CAST(nsIClassInfo *, this);
}

nsGenericFactory::~nsGenericFactory()
{
    if (mInfo) {
        if (mInfo->mFactoryDestructor)
            mInfo->mFactoryDestructor();
        if (mInfo->mClassInfoGlobal)
            *mInfo->mClassInfoGlobal = 0;
    }
}

NS_IMPL_THREADSAFE_ISUPPORTS3(nsGenericFactory,
                              nsIGenericFactory, 
                              nsIFactory,
                              nsIClassInfo)

NS_IMETHODIMP nsGenericFactory::CreateInstance(nsISupports *aOuter,
                                               REFNSIID aIID, void **aResult)
{
    if (!mInfo || !mInfo->mConstructor) {
        *aResult = nsnull;
        return NS_ERROR_FACTORY_NOT_REGISTERED;
    }
    return mInfo->mConstructor(aOuter, aIID, aResult);
}

NS_IMETHODIMP nsGenericFactory::LockFactory(PRBool aLock)
{
    // XXX do we care if (mInfo->mFlags & THREADSAFE)?
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetInterfaces(PRUint32 *countp,
                                              nsIID* **array)
{
    if (!mInfo || !mInfo->mGetInterfacesProc) {
        *countp = 0;
        *array = nsnull;
        return NS_OK;
    }
    return mInfo->mGetInterfacesProc(countp, array);
}

NS_IMETHODIMP nsGenericFactory::GetHelperForLanguage(PRUint32 language,
                                                     nsISupports **helper)
{
    if (mInfo && mInfo->mGetLanguageHelperProc)
        return mInfo->mGetLanguageHelperProc(language, helper);
    *helper = nsnull;
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetContractID(char **aContractID)
{
    const char *contractID = NS_GENERICFACTORY_CONTRACTID;
    if (mInfo && mInfo->mContractID)
        contractID = mInfo->mContractID;
    *aContractID = (char *)nsMemory::Clone(contractID, strlen(contractID) + 1);
    if (!*aContractID)
        return NS_ERROR_OUT_OF_MEMORY;
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetClassDescription(char * *aClassDescription)
{
    const char* description =
        "The prototypical implementation for a `factory' class, "
        "that is, a class used to produce instance objects";
    if (mInfo && mInfo->mDescription)
        description=mInfo->mDescription;
    *aClassDescription = (char *)nsMemory::Clone(description, strlen(description) + 1);
    if (!*aClassDescription)
        return NS_ERROR_OUT_OF_MEMORY;
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetClassID(nsCID * *aClassID)
{
    *aClassID = NS_REINTERPRET_CAST(nsCID*, nsMemory::Alloc(sizeof(nsCID)));
    if (!*aClassID)
        return NS_ERROR_OUT_OF_MEMORY;
    return GetClassIDNoAlloc(*aClassID);
}

NS_IMETHODIMP nsGenericFactory::GetClassIDNoAlloc(nsCID *aClassID)
{
    if (mInfo)
        *aClassID = mInfo->mCID;
    else
        *aClassID = GetCID();
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetImplementationLanguage(PRUint32 *langp)
{
    *langp = nsIProgrammingLanguage::CPLUSPLUS;
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetFlags(PRUint32 *flagsp)
{
    if (!mInfo)
        return NS_ERROR_NOT_AVAILABLE;

    *flagsp = mInfo->mFlags;
    return NS_OK;
}

// nsIGenericFactory: component-info accessors
NS_IMETHODIMP nsGenericFactory::SetComponentInfo(const nsModuleComponentInfo *info)
{
    if (mInfo && mInfo->mClassInfoGlobal)
        *mInfo->mClassInfoGlobal = 0;
    mInfo = info;
    if (mInfo && mInfo->mClassInfoGlobal)
        *mInfo->mClassInfoGlobal = NS_STATIC_CAST(nsIClassInfo *, this);
    return NS_OK;
}

NS_IMETHODIMP nsGenericFactory::GetComponentInfo(const nsModuleComponentInfo **infop)
{
    *infop = mInfo;
    return NS_OK;
}

NS_METHOD nsGenericFactory::Create(nsISupports* outer, const nsIID& aIID, void* *aInstancePtr)
{
    // sorry, aggregation not spoken here.
    if (outer)
        return NS_ERROR_NO_AGGREGATION;
    nsGenericFactory* factory = new nsGenericFactory;
    if (!factory)
        return NS_ERROR_OUT_OF_MEMORY;
    nsresult rv = factory->QueryInterface(aIID, aInstancePtr);
    if (NS_FAILED(rv))
        delete factory;
    return rv;
}

NS_COM nsresult
NS_NewGenericFactory(nsIGenericFactory* *result,
                     const nsModuleComponentInfo *info)
{
    nsresult rv;
    nsIGenericFactory* fact;
    rv = nsGenericFactory::Create(nsnull, NS_GET_IID(nsIGenericFactory), (void**)&fact);
    if (NS_FAILED(rv)) return rv;
    rv = fact->SetComponentInfo(info);
    if (NS_FAILED(rv)) goto error;
    *result = fact;
    return rv;

  error:
    NS_RELEASE(fact);
    return rv;
}

////////////////////////////////////////////////////////////////////////////////

nsGenericModule::nsGenericModule(const char* moduleName, PRUint32 componentCount,
                                 const nsModuleComponentInfo* components,
                                 nsModuleConstructorProc ctor,
                                 nsModuleDestructorProc dtor)
    : mInitialized(PR_FALSE), 
      mModuleName(moduleName),
      mComponentCount(componentCount),
      mComponents(components),
      mFactoriesNotToBeRegistered(nsnull),
      mCtor(ctor),
      mDtor(dtor)
{
    NS_INIT_ISUPPORTS();
}

nsGenericModule::~nsGenericModule()
{
    Shutdown();
}

NS_IMPL_THREADSAFE_ISUPPORTS1(nsGenericModule, nsIModule)

nsresult 
nsGenericModule::AddFactoryNode(nsIGenericFactory* fact)
{
    if (!fact)
        return NS_ERROR_FAILURE;

    FactoryNode *node = new FactoryNode(fact, mFactoriesNotToBeRegistered);
    if (!node)
        return NS_ERROR_OUT_OF_MEMORY;
    
    mFactoriesNotToBeRegistered = node;
    return NS_OK;
}


// Perform our one-time intialization for this module
nsresult
nsGenericModule::Initialize(nsIComponentManager *compMgr)
{
    if (mInitialized) {
        return NS_OK;
    }

    if (mCtor) {
        nsresult rv = mCtor(this);
        if (NS_FAILED(rv))
            return rv;
    }

    nsresult rv;
    nsCOMPtr<nsIComponentRegistrar> registrar = do_QueryInterface(compMgr, &rv);
    if (NS_FAILED(rv))
        return rv;

    // Eagerly populate factory/class object hash for entries
    // without constructors. If we didn't, the class object would
    // never get created. Also create the factory, which doubles
    // as the class object, if the EAGER_CLASSINFO flag was given.
    // This allows objects to be created (within their modules)
    // via operator new rather than CreateInstance, yet still be
    // QI'able to nsIClassInfo.
    const nsModuleComponentInfo* desc = mComponents;
    for (PRUint32 i = 0; i < mComponentCount; i++) {
        if (!desc->mConstructor ||
            (desc->mFlags & nsIClassInfo::EAGER_CLASSINFO)) {
            nsCOMPtr<nsIGenericFactory> fact;
            nsresult rv = NS_NewGenericFactory(getter_AddRefs(fact), desc);
            if (NS_FAILED(rv)) return rv;

            // if we don't have a mConstructor, then we should not populate
            // the component manager.
            if (!desc->mConstructor) {
                rv = AddFactoryNode(fact);
            } else {
                rv = registrar->RegisterFactory(desc->mCID, 
                                                desc->mDescription,
                                                desc->mContractID, 
                                                fact);
            }
            if (NS_FAILED(rv)) return rv;
        }
        desc++;
    }

    mInitialized = PR_TRUE;
    return NS_OK;
}

// Shutdown this module, releasing all of the module resources
void
nsGenericModule::Shutdown()
{
    // Free cached factories that were not registered.
    FactoryNode* node;
    while (mFactoriesNotToBeRegistered)
    {
        node = mFactoriesNotToBeRegistered->mNext;
        delete mFactoriesNotToBeRegistered;
        mFactoriesNotToBeRegistered = node;
    }

    if (mInitialized) {
        mInitialized = PR_FALSE;

        if (mDtor)
            mDtor(this);
    }
}

// Create a factory object for creating instances of aClass.
NS_IMETHODIMP
nsGenericModule::GetClassObject(nsIComponentManager *aCompMgr,
                                const nsCID& aClass,
                                const nsIID& aIID,
                                void** r_classObj)
{
    nsresult rv;

    // Defensive programming: Initialize *r_classObj in case of error below
    if (!r_classObj) {
        return NS_ERROR_INVALID_POINTER;
    }
    *r_classObj = nsnull;

    // Do one-time-only initialization if necessary
    if (!mInitialized) {
        rv = Initialize(aCompMgr);
        if (NS_FAILED(rv)) {
            // Initialization failed! yikes!
            return rv;
        }
    }

    // Choose the appropriate factory, based on the desired instance
    // class type (aClass).
    const nsModuleComponentInfo* desc = mComponents;
    for (PRUint32 i = 0; i < mComponentCount; i++) {
        if (desc->mCID.Equals(aClass)) {
            nsCOMPtr<nsIGenericFactory> fact;
            rv = NS_NewGenericFactory(getter_AddRefs(fact), desc);
            if (NS_FAILED(rv)) return rv;
            return fact->QueryInterface(aIID, r_classObj);
        }
        desc++;
    }
    // not found in descriptions
#ifndef XPCOM_GLUE
#ifdef DEBUG 
    char* cs = aClass.ToString();
    fprintf(stderr, "+++ nsGenericModule %s: unable to create factory for %s\n", mModuleName, cs);
    // leak until we resolve the nsID Allocator. 
    // nsCRT::free(cs);
#endif        // XXX put in stop-gap so that we don't search for this one again
#endif 
    return NS_ERROR_FACTORY_NOT_REGISTERED;
}

NS_IMETHODIMP
nsGenericModule::RegisterSelf(nsIComponentManager *aCompMgr,
                              nsIFile* aPath,
                              const char* registryLocation,
                              const char* componentType)
{
    nsresult rv = NS_OK;

#ifdef DEBUG
    fprintf(stderr, "*** Registering %s components (all right -- a generic module!)\n", mModuleName);
#endif

    const nsModuleComponentInfo* cp = mComponents;
    for (PRUint32 i = 0; i < mComponentCount; i++) {
        // Register the component only if it has a constructor
        if (cp->mConstructor) {
            nsCOMPtr<nsIComponentRegistrar> registrar = do_QueryInterface(aCompMgr, &rv);
            if (registrar)
                rv = registrar->RegisterFactoryLocation(cp->mCID, 
                                                        cp->mDescription,
                                                        cp->mContractID, 
                                                        aPath,
                                                        registryLocation,
                                                        componentType);
            if (NS_FAILED(rv)) {
#ifdef DEBUG
                fprintf(stderr, "nsGenericModule %s: unable to register %s component => %x\n",
                       mModuleName?mModuleName:"(null)", cp->mDescription?cp->mDescription:"(null)", rv);
#endif
                break;
            }
        }
        // Call the registration hook of the component, if any
        if (cp->mRegisterSelfProc)
        {
            rv = cp->mRegisterSelfProc(aCompMgr, aPath, registryLocation,
                                       componentType, cp);
            if (NS_FAILED(rv)) {
#ifdef DEBUG
                fprintf(stderr, "nsGenericModule %s: Register hook for %s component returned error => %x\n",
                       mModuleName?mModuleName:"(null)", cp->mDescription?cp->mDescription:"(null)", rv);
#endif
                break;
            }
        }
        cp++;
    }

    return rv;
}

NS_IMETHODIMP
nsGenericModule::UnregisterSelf(nsIComponentManager* aCompMgr,
                            nsIFile* aPath,
                            const char* registryLocation)
{
#ifdef DEBUG
    fprintf(stderr, "*** Unregistering %s components (all right -- a generic module!)\n", mModuleName);
#endif
    const nsModuleComponentInfo* cp = mComponents;
    for (PRUint32 i = 0; i < mComponentCount; i++) {
        // Call the unregistration hook of the component, if any
        if (cp->mUnregisterSelfProc)
        {
            cp->mUnregisterSelfProc(aCompMgr, aPath, registryLocation, cp);
        }

        // Unregister the component
        nsresult rv; 
        nsCOMPtr<nsIComponentRegistrar> registrar = do_QueryInterface(aCompMgr, &rv);
        if (registrar)
             rv = registrar->UnregisterFactoryLocation(cp->mCID, aPath);
        if (NS_FAILED(rv)) {
#ifdef DEBUG
            fprintf(stderr, "nsGenericModule %s: unable to unregister %s component => %x\n",
                   mModuleName, cp->mDescription, rv);
#endif
        }
        cp++;
    }

    return NS_OK;
}

NS_IMETHODIMP
nsGenericModule::CanUnload(nsIComponentManager *aCompMgr, PRBool *okToUnload)
{
    if (!okToUnload) {
        return NS_ERROR_INVALID_POINTER;
    }
    *okToUnload = PR_FALSE;
    return NS_ERROR_FAILURE;
}

NS_COM nsresult
NS_NewGenericModule2(nsModuleInfo* info, nsIModule* *result)
{
    nsresult rv = NS_OK;

    // Create and initialize the module instance
    nsGenericModule *m = 
        new nsGenericModule(info->mModuleName, info->mCount, info->mComponents,
                            info->mCtor, info->mDtor);

    if (!m)
        return NS_ERROR_OUT_OF_MEMORY;

    // Increase refcnt and store away nsIModule interface to m in return_cobj
    rv = m->QueryInterface(NS_GET_IID(nsIModule), (void**)result);
    if (NS_FAILED(rv)) {
        delete m;
    }
    return rv;
}

NS_COM nsresult
NS_NewGenericModule(const char* moduleName,
                    PRUint32 componentCount,
                    nsModuleComponentInfo* components,
                    nsModuleDestructorProc dtor,
                    nsIModule* *result)
{
    nsModuleInfo info;
    memset(&info, 0, sizeof(info));

    info.mVersion    = NS_MODULEINFO_VERSION;
    info.mModuleName = moduleName;
    info.mComponents = components;
    info.mCount      = componentCount;
    info.mDtor       = dtor;

    return NS_NewGenericModule2(&info, result);
}

////////////////////////////////////////////////////////////////////////////////
