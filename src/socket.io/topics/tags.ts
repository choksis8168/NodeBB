'use strict';

import * as meta from '../../meta';
import * as user from '../../user';
import * as topics from '../../topics';
import * as categories from '../../categories';
import * as privileges from '../../privileges';
import * as utils from '../../utils';

module.exports = function (SocketTopics: any) {
    SocketTopics.isTagAllowed = async function (socket: any, data: any) {
        if (!data || !utils.isNumber(data.cid) || !data.tag) {
            throw new Error('[[error:invalid-data]]');
        }

        const systemTags = (meta.config.systemTags || '').split(',');
        const [tagWhitelist, isPrivileged] = await Promise.all([
            categories.getTagWhitelist([data.cid]),
            user.isPrivileged(socket.uid),
        ]);
        return isPrivileged ||
            (
                !systemTags.includes(data.tag) &&
                (!tagWhitelist[0].length || tagWhitelist[0].includes(data.tag))
            );
    };

    SocketTopics.canRemoveTag = async function (socket: any, data: any) {
        if (!data || !data.tag) {
            throw new Error('[[error:invalid-data]]');
        }

        const systemTags = (meta.config.systemTags || '').split(',');
        const isPrivileged = await user.isPrivileged(socket.uid);
        return isPrivileged || !systemTags.includes(String(data.tag).trim());
    };

    SocketTopics.autocompleteTags = async function (socket: any, data: any) {
        if (data.cid) {
            const canRead = await privileges.categories.can('topics:read', data.cid, socket.uid);
            if (!canRead) {
                throw new Error('[[error:no-privileges]]');
            }
        }
        data.cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
        const result = await topics.autocompleteTags(data);
        return result.map((tag: any) => tag.value);
    };

    SocketTopics.searchTags = async function (socket: any, data: any) {
        const result = await searchTags(socket.uid, topics.searchTags, data);
        return result.map((tag: any) => tag.value);
    };

    SocketTopics.searchAndLoadTags = async function (socket: any, data: any) {
        return await searchTags(socket.uid, topics.searchAndLoadTags, data);
    };

    async function searchTags(uid: any, method: any, data: any) {
        const allowed = await privileges.global.can('search:tags', uid);
        if (!allowed) {
            throw new Error('[[error:no-privileges]]');
        }
        if (data.cid) {
            const canRead = await privileges.categories.can('topics:read', data.cid, uid);
            if (!canRead) {
                throw new Error('[[error:no-privileges]]');
            }
        }
        data.cids = await categories.getCidsByPrivilege('categories:cid', uid, 'topics:read');
        return await method(data);
    }

    SocketTopics.loadMoreTags = async function (socket: any, data: any) {
        if (!data || !utils.isNumber(data.after)) {
            throw new Error('[[error:invalid-data]]');
        }

        const start = parseInt(data.after, 10);
        const stop = start + 99;
        const cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
        const tags = await topics.getCategoryTagsData(cids, start, stop);
        return { tags: tags.filter(Boolean), nextStart: stop + 1 };
    };
};