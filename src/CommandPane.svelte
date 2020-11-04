<script>
    import { Confirm } from "svelte-confirm";
    import SvelteTooltip from "svelte-tooltip";
    import IoIosVolumeOff from "svelte-icons/io/IoIosVolumeOff.svelte";
    import IoIosVolumeHigh from "svelte-icons/io/IoIosVolumeHigh.svelte";
    import IoMdEyeOff from "svelte-icons/io/IoMdEyeOff.svelte";
    import IoMdEye from "svelte-icons/io/IoMdEye.svelte";
    import IoMdCall from "svelte-icons/io/IoMdCall.svelte";
    import MdScreenShare from "svelte-icons/md/MdScreenShare.svelte";
    import MdStopScreenShare from "svelte-icons/md/MdStopScreenShare.svelte";
    import MdBrandingWatermark from "svelte-icons/md/MdBrandingWatermark.svelte";
    import MdApps from "svelte-icons/md/MdApps.svelte";

    export let layout = "main";
    export let isMuted = false;
    export let isVideoHidden = false;
    export let isScreenShared = false;

    export let toggleView = null;
    export let toggleMute = null;
    export let toggleVideo = null;
    export let toggleScreenShare = null;
    export let endCall = null;
</script>

<style>
    .commandContainer {
        position: fixed;
        top: 100px;
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: center;
        z-index: 40;
    }
    .icon {
        display: inline-block;
        color: white;
        width: 24px;
        height: 24px;
        margin: 4px 0px;
        align-self: center;
    }
    .icon-button {
        display: flex;
        flex-direction: row;
        align-content: center;
        margin: 3px 2px;
        line-height: initial;
    }
</style>

<div class="commandContainer">
    <!-- Layout -->
    <SvelteTooltip
        tip={layout === 'main' ? 'Gallery View' : 'Main Speaker View'}
        bottom>
        <button
            class="icon-button"
            on:click={toggleView}>{#if layout === 'main'}
                <div class="icon">
                    <MdApps />
                </div>
            {:else}
                <div class="icon">
                    <MdBrandingWatermark />
                </div>
            {/if}</button>
    </SvelteTooltip>
    <!-- Mute -->
    <SvelteTooltip tip={isMuted ? 'Unmute' : 'Mute'} bottom>
        <button
            class="icon-button"
            on:click={toggleMute}
            style={isMuted ? 'background: grey' : ''}>{#if isMuted}
                <div class="icon">
                    <IoIosVolumeHigh />
                </div>
            {:else}
                <div class="icon">
                    <IoIosVolumeOff />
                </div>
            {/if}</button>
    </SvelteTooltip>
    <!-- Turn video on/off -->
    <SvelteTooltip tip={isVideoHidden ? 'Show video' : 'Stop video'} bottom>
        <button
            class="icon-button"
            style={isVideoHidden ? 'background: grey' : ''}
            on:click={toggleVideo}>{#if isVideoHidden}
                <div class="icon">
                    <IoMdEye />
                </div>
            {:else}
                <div class="icon">
                    <IoMdEyeOff />
                </div>
            {/if}</button>
    </SvelteTooltip>
    <!-- Screen sharing -->
    <SvelteTooltip
        tip={isScreenShared ? 'Unshare screen' : 'Share screen'}
        bottom>
        <button class="icon-button" on:click={toggleScreenShare}>
            <div class="icon">
                {#if isScreenShared}
                    <MdStopScreenShare />
                {:else}
                    <MdScreenShare />
                {/if}
            </div></button>
    </SvelteTooltip>
    <!-- End call, request confirmation if there are other users in the call -->
    <Confirm let:confirm={confirmThis}>
        <SvelteTooltip tip={'End Call'} bottom>
            <button
                class="icon-button"
                style="background: red;"
                on:click={() => confirmThis(endCall)}><div class="icon">
                    <IoMdCall />
                </div></button>
        </SvelteTooltip>
        <span slot="title"> End Call </span>
        <span slot="description"> Are you sure you want to end the call? </span>
    </Confirm>
</div>
<!-- End control panel -->
